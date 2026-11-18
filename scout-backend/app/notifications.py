"""
app/notifications.py — Expo Push Notification dispatcher & event/reversal diff engine.
Handles both local tournaments (Supabase) and BSD live matches.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

from app.config import bsd_get
from app.supabase import get_supabase

log = logging.getLogger("scout.notifications")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _db():
    return get_supabase()


def _rows(res) -> list[dict]:
    return list(res.data or [])


def _one(res) -> dict | None:
    return res.data[0] if res.data else None


# ── Expo Push Delivery ────────────────────────────────────────────────

def _send_expo_messages(messages: list[dict]) -> None:
    if not messages:
        return
    headers = {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
    }
    for i in range(0, len(messages), 100):
        chunk = messages[i : i + 100]
        try:
            resp = requests.post(EXPO_PUSH_URL, json=chunk, headers=headers, timeout=10)
            if resp.status_code == 200:
                data = resp.json().get("data", [])
                for msg, ticket in zip(chunk, data):
                    if (
                        ticket.get("status") == "error"
                        and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered"
                    ):
                        _db().table("device_push_tokens").update({"active": False}).eq(
                            "expo_push_token", msg["to"]
                        ).execute()
        except Exception as exc:
            log.warning("Expo push batch failed: %s", exc)


def _matching_tokens(
    source: str,
    match_ref: str,
    team_keys: list[str],
) -> list[str]:
    """Find active Expo push tokens following any of the teams or this match."""
    rows = _rows(
        _db()
        .table("device_push_tokens")
        .select("expo_push_token, followed_teams, followed_matches")
        .eq("active", True)
        .execute()
    )
    if not rows:
        return []

    wanted_teams = {str(k).strip().lower() for k in team_keys if k is not None and str(k).strip()}
    wanted_matches = {
        str(match_ref).strip().lower(),
        f"{source}:{str(match_ref).strip().lower()}",
    }

    tokens: list[str] = []
    for r in rows:
        t_list = {str(x).strip().lower() for x in (r.get("followed_teams") or []) if x}
        m_list = {str(x).strip().lower() for x in (r.get("followed_matches") or []) if x}
        if (wanted_teams & t_list) or (wanted_matches & m_list):
            tokens.append(r["expo_push_token"])
    return list(dict.fromkeys(tokens))


def dispatch_match_alert(
    *,
    event_uid: str,
    source: str,
    match_ref: str,
    event_type: str,
    title: str,
    body: str,
    team_keys: list[str],
    data: dict[str, Any],
    player_name: str | None = None,
    minute: int | None = None,
    allow_repeat: bool = False,
) -> bool:
    """Idempotently log an alert in dispatched_match_events and push to followers."""
    existing = _one(
        _db()
        .table("dispatched_match_events")
        .select("event_uid, is_cancelled")
        .eq("event_uid", event_uid)
        .limit(1)
        .execute()
    )
    if existing and not allow_repeat:
        return False

    record = {
        "event_uid": event_uid,
        "source": source,
        "match_ref": str(match_ref),
        "event_type": event_type,
        "player_name": player_name,
        "minute": minute,
        "payload": {"title": title, "body": body, **data},
        "is_cancelled": False,
        "cancelled_at": None,
    }
    _db().table("dispatched_match_events").upsert(record, on_conflict="event_uid").execute()

    tokens = _matching_tokens(source, str(match_ref), team_keys)
    if not tokens:
        return True

    messages = [
        {
            "to": tok,
            "sound": "default",
            "channelId": "match-alerts",
            "title": title,
            "body": body,
            "data": {"source": source, **data},
        }
        for tok in tokens
    ]
    _send_expo_messages(messages)
    return True


def dispatch_reversal_alert(
    *,
    original_event_uid: str,
    source: str,
    match_ref: str,
    reversal_type: str,
    title: str,
    body: str,
    team_keys: list[str],
    data: dict[str, Any],
    player_name: str | None = None,
    minute: int | None = None,
) -> None:
    """Mark an earlier event cancelled and send a correction push naming the player."""
    now_iso = datetime.now(timezone.utc).isoformat()
    _db().table("dispatched_match_events").update(
        {"is_cancelled": True, "cancelled_at": now_iso}
    ).eq("event_uid", original_event_uid).execute()

    cancel_uid = f"{original_event_uid}:cancelled:{int(time.time())}"
    dispatch_match_alert(
        event_uid=cancel_uid,
        source=source,
        match_ref=str(match_ref),
        event_type=reversal_type,
        title=title,
        body=body,
        team_keys=team_keys,
        data=data,
        player_name=player_name,
        minute=minute,
        allow_repeat=True,
    )


# ── Local Tournament Helpers ──────────────────────────────────────────

def _local_fixture_context(fixture_id: str) -> dict | None:
    fx = _one(_db().table("fixtures").select("*").eq("id", fixture_id).limit(1).execute())
    if not fx:
        return None
    teams = _rows(
        _db()
        .table("tournament_teams")
        .select("id, club_id, clubs(name, short_name)")
        .in_("id", [fx["home_team_id"], fx["away_team_id"]])
        .execute()
    )
    t_map = {t["id"]: t for t in teams}
    home_row = t_map.get(fx["home_team_id"]) or {}
    away_row = t_map.get(fx["away_team_id"]) or {}
    home_club = home_row.get("clubs") or {}
    away_club = away_row.get("clubs") or {}

    home_name = home_club.get("name") or "Home"
    away_name = away_club.get("name") or "Away"
    team_keys = [
        home_name,
        home_club.get("short_name") or "",
        away_name,
        away_club.get("short_name") or "",
        fx["home_team_id"],
        fx["away_team_id"],
        home_row.get("club_id") or "",
        away_row.get("club_id") or "",
    ]
    return {
        "fx": fx,
        "home_name": home_name,
        "away_name": away_name,
        "team_keys": [k for k in team_keys if k],
        "nav_data": {
            "source": "local",
            "tournamentId": fx["tournament_id"],
            "fixtureId": fixture_id,
        },
    }


def _player_full_name(player_id: str | None) -> str:
    if not player_id:
        return "Player"
    p = _one(
        _db()
        .table("players")
        .select("first_name, last_name")
        .eq("id", player_id)
        .limit(1)
        .execute()
    )
    if not p:
        return "Player"
    return f"{p.get('first_name', '')} {p.get('last_name', '')}".strip() or "Player"


def notify_local_score_or_status(
    fixture_id: str,
    old_fx: dict,
    new_fx: dict,
) -> None:
    ctx = _local_fixture_context(fixture_id)
    if not ctx:
        return

    home = ctx["home_name"]
    away = ctx["away_name"]
    old_status = str(old_fx.get("status") or "scheduled").lower()
    new_status = str(new_fx.get("status") or "scheduled").lower()

    old_h = old_fx.get("home_score")
    old_a = old_fx.get("away_score")
    new_h = new_fx.get("home_score")
    new_a = new_fx.get("away_score")
    score_str = f"{home} {new_h if new_h is not None else 0}-{new_a if new_a is not None else 0} {away}"

    # Status transitions
    if old_status != new_status:
        if new_status == "live" and old_status == "scheduled":
            dispatch_match_alert(
                event_uid=f"local:{fixture_id}:kickoff",
                source="local",
                match_ref=fixture_id,
                event_type="kickoff",
                title=f"Kickoff: {home} vs {away}",
                body=f"The match has started — {score_str}",
                team_keys=ctx["team_keys"],
                data=ctx["nav_data"],
            )
        elif new_status == "ht":
            dispatch_match_alert(
                event_uid=f"local:{fixture_id}:ht",
                source="local",
                match_ref=fixture_id,
                event_type="halftime",
                title=f"Half-Time: {score_str}",
                body=f"It's half-time between {home} and {away}.",
                team_keys=ctx["team_keys"],
                data=ctx["nav_data"],
            )
        elif new_status == "ft":
            dispatch_match_alert(
                event_uid=f"local:{fixture_id}:ft",
                source="local",
                match_ref=fixture_id,
                event_type="fulltime",
                title=f"Full-Time: {score_str}",
                body=f"Final whistle: {score_str}",
                team_keys=ctx["team_keys"],
                data=ctx["nav_data"],
            )

    # Scoreboard correction / drop detection
    if (
        old_h is not None
        and old_a is not None
        and new_h is not None
        and new_a is not None
        and (new_h < old_h or new_a < old_a)
    ):
        dispatch_match_alert(
            event_uid=f"local:{fixture_id}:score_fix:{old_h}_{old_a}_to_{new_h}_{new_a}:{int(time.time())}",
            source="local",
            match_ref=fixture_id,
            event_type="score_corrected",
            title=f"Score Corrected: {score_str}",
            body=f"Scoreline updated from {old_h}-{old_a} to {new_h}-{new_a}.",
            team_keys=ctx["team_keys"],
            data=ctx["nav_data"],
            allow_repeat=True,
        )


def notify_local_event_created(fixture_id: str, event_row: dict) -> None:
    ctx = _local_fixture_context(fixture_id)
    if not ctx:
        return

    home = ctx["home_name"]
    away = ctx["away_name"]
    fx = ctx["fx"]
    h_score = fx.get("home_score") if fx.get("home_score") is not None else 0
    a_score = fx.get("away_score") if fx.get("away_score") is not None else 0
    score_str = f"{home} {h_score}-{a_score} {away}"

    etype = event_row["type"]
    minute = event_row.get("minute")
    min_txt = f"{minute}'" if minute is not None else ""
    player = _player_full_name(event_row.get("player_id"))
    sub_in = _player_full_name(event_row.get("related_player_id")) if etype == "substitution" else None
    team_side = home if event_row["tournament_team_id"] == fx["home_team_id"] else away

    if etype in {"goal", "penalty_scored", "own_goal"}:
        tag = " (Pen)" if etype == "penalty_scored" else (" (OG)" if etype == "own_goal" else "")
        title = f"GOAL! {player}{tag} {min_txt}".strip()
        body = f"{team_side} — {score_str}"
    elif etype == "penalty_missed":
        title = f"Penalty Missed — {player} {min_txt}".strip()
        body = f"{team_side} fail to convert ({score_str})"
    elif etype == "yellow":
        title = f"Yellow Card — {player} {min_txt}".strip()
        body = f"{team_side} ({home} vs {away})"
    elif etype in {"red", "second_yellow"}:
        title = f"RED CARD! {player} {min_txt}".strip()
        body = f"{team_side} down a player ({score_str})"
    elif etype == "substitution":
        title = f"Substitution ({team_side}) {min_txt}".strip()
        body = f"IN: {sub_in} | OUT: {player}"
    else:
        return

    dispatch_match_alert(
        event_uid=f"local:{fixture_id}:event:{event_row['id']}",
        source="local",
        match_ref=fixture_id,
        event_type=etype,
        title=title,
        body=body,
        team_keys=ctx["team_keys"],
        data=ctx["nav_data"],
        player_name=player,
        minute=minute,
    )


def notify_local_event_deleted(fixture_id: str, event_row: dict) -> None:
    ctx = _local_fixture_context(fixture_id)
    if not ctx:
        return

    home = ctx["home_name"]
    away = ctx["away_name"]
    fx = ctx["fx"]
    h_score = fx.get("home_score") if fx.get("home_score") is not None else 0
    a_score = fx.get("away_score") if fx.get("away_score") is not None else 0
    score_str = f"{home} {h_score}-{a_score} {away}"

    etype = event_row["type"]
    minute = event_row.get("minute")
    min_txt = f" ({minute}')" if minute is not None else ""
    player = _player_full_name(event_row.get("player_id"))

    if etype in {"goal", "penalty_scored", "own_goal"}:
        rev_type = "goal_disallowed"
        title = f"Goal Disallowed — {player}{min_txt}"
        body = f"Goal ruled out. Score is {score_str}."
    elif etype in {"penalty_missed", "penalty_saved"}:
        rev_type = "penalty_cancelled"
        title = f"Penalty Cancelled — {player}{min_txt}"
        body = f"Penalty incident overturned ({home} vs {away})."
    elif etype == "yellow":
        rev_type = "yellow_card_cancelled"
        title = f"Yellow Card Cancelled — {player}{min_txt}"
        body = f"Booking rescinded ({home} vs {away})."
    elif etype in {"red", "second_yellow"}:
        rev_type = "red_card_cancelled"
        title = f"Red Card Cancelled — {player}{min_txt}"
        body = f"Sending off overturned for {player} ({home} vs {away})."
    elif etype == "substitution":
        rev_type = "substitution_cancelled"
        title = f"Substitution Cancelled — {player}{min_txt}"
        body = f"Substitution removed ({home} vs {away})."
    else:
        return

    dispatch_reversal_alert(
        original_event_uid=f"local:{fixture_id}:event:{event_row['id']}",
        source="local",
        match_ref=fixture_id,
        reversal_type=rev_type,
        title=title,
        body=body,
        team_keys=ctx["team_keys"],
        data=ctx["nav_data"],
        player_name=player,
        minute=minute,
    )


def notify_local_lineup_confirmed(fixture_id: str, tournament_team_id: str) -> None:
    ctx = _local_fixture_context(fixture_id)
    if not ctx:
        return

    team_row = _one(
        _db()
        .table("tournament_teams")
        .select("clubs(name)")
        .eq("id", tournament_team_id)
        .limit(1)
        .execute()
    )
    team_name = ((team_row or {}).get("clubs") or {}).get("name") or "Team"

    dispatch_match_alert(
        event_uid=f"local:{fixture_id}:lineup:{tournament_team_id}",
        source="local",
        match_ref=fixture_id,
        event_type="lineup_confirmed",
        title=f"Lineup Confirmed: {team_name}",
        body=f"Starting XI is out for {ctx['home_name']} vs {ctx['away_name']}.",
        team_keys=ctx["team_keys"],
        data=ctx["nav_data"],
    )


# ── Background Poller: Reminders & BSD Live Diffing ───────────────────

def _check_local_reminders() -> None:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(minutes=15)
    upcoming = _rows(
        _db()
        .table("fixtures")
        .select("id, kickoff_at")
        .eq("status", "scheduled")
        .gte("kickoff_at", now.isoformat())
        .lte("kickoff_at", horizon.isoformat())
        .execute()
    )
    for row in upcoming:
        ctx = _local_fixture_context(row["id"])
        if not ctx:
            continue
        dispatch_match_alert(
            event_uid=f"local:{row['id']}:reminder",
            source="local",
            match_ref=row["id"],
            event_type="match_reminder",
            title=f"Starting Soon: {ctx['home_name']} vs {ctx['away_name']}",
            body="Kickoff is in 15 minutes!",
            team_keys=ctx["team_keys"],
            data=ctx["nav_data"],
        )


def _poll_bsd_live_events() -> None:
    """Diff BSD live matches and incidents for followed teams/matches."""
    tokens = _rows(
        _db()
        .table("device_push_tokens")
        .select("followed_teams, followed_matches")
        .eq("active", True)
        .execute()
    )
    if not tokens:
        return

    followed_teams = {
        str(t).strip().lower()
        for row in tokens
        for t in (row.get("followed_teams") or [])
        if t
    }
    followed_matches = {
        str(m).strip().lower()
        for row in tokens
        for m in (row.get("followed_matches") or [])
        if m
    }
    if not followed_teams and not followed_matches:
        return

    live_data = bsd_get("/events/live/")
    if not live_data:
        return

    for ev in live_data.get("events", []):
        eid = ev.get("id")
        if eid is None:
            continue
        eid_str = str(eid)
        home = str(ev.get("home_team") or "")
        away = str(ev.get("away_team") or "")
        h_id = str(ev.get("home_team_id") or "")
        a_id = str(ev.get("away_team_id") or "")

        team_keys = [k for k in [home, away, h_id, a_id] if k]
        is_watched = (
            any(k.lower() in followed_teams for k in team_keys)
            or (eid_str in followed_matches)
            or (f"bsd:{eid_str}" in followed_matches)
        )
        if not is_watched:
            continue

        status = str(ev.get("status") or "").lower()
        h_score = ev.get("home_score") or 0
        a_score = ev.get("away_score") or 0
        score_str = f"{home} {h_score}-{a_score} {away}"
        nav_data = {"source": "bsd", "eventId": eid}

        if status in {"inprogress", "live", "1st_half"}:
            dispatch_match_alert(
                event_uid=f"bsd:{eid_str}:kickoff",
                source="bsd",
                match_ref=eid_str,
                event_type="kickoff",
                title=f"Kickoff: {home} vs {away}",
                body=f"Match underway — {score_str}",
                team_keys=team_keys,
                data=nav_data,
            )
        elif status in {"halftime", "ht"}:
            dispatch_match_alert(
                event_uid=f"bsd:{eid_str}:ht",
                source="bsd",
                match_ref=eid_str,
                event_type="halftime",
                title=f"Half-Time: {score_str}",
                body=f"Half-time in {home} vs {away}.",
                team_keys=team_keys,
                data=nav_data,
            )
        elif status in {"finished", "ft"}:
            dispatch_match_alert(
                event_uid=f"bsd:{eid_str}:ft",
                source="bsd",
                match_ref=eid_str,
                event_type="fulltime",
                title=f"Full-Time: {score_str}",
                body=f"Final score: {score_str}",
                team_keys=team_keys,
                data=nav_data,
            )

        # Fetch full match detail for followed live matches to diff lineups, incidents & reversals
        detail = bsd_get(f"/events/{eid}/")
        if not detail:
            continue

        lineups = detail.get("lineups") or {}
        if lineups.get("home") or lineups.get("away"):
            dispatch_match_alert(
                event_uid=f"bsd:{eid_str}:lineup",
                source="bsd",
                match_ref=eid_str,
                event_type="lineup_confirmed",
                title=f"Lineups Confirmed: {home} vs {away}",
                body="Starting XIs have been announced.",
                team_keys=team_keys,
                data=nav_data,
            )

        current_uids: set[str] = set()
        for inc in detail.get("incidents") or []:
            itype = str(inc.get("type") or inc.get("incident_type") or "").lower()
            minute = inc.get("time") or inc.get("minute")
            player = str(inc.get("player_name") or inc.get("player") or "Player")
            inc_id = inc.get("id") or f"{itype}:{minute}:{player}"
            uid = f"bsd:{eid_str}:inc:{inc_id}"
            current_uids.add(uid)

            if "goal" in itype and "disallow" not in itype:
                mapped = "goal"
                title = f"GOAL! {player} {minute}'"
                body = score_str
            elif "penalty" in itype and "miss" in itype:
                mapped = "penalty_missed"
                title = f"Penalty Missed — {player} {minute}'"
                body = score_str
            elif "red" in itype:
                mapped = "red"
                title = f"RED CARD! {player} {minute}'"
                body = score_str
            elif "yellow" in itype:
                mapped = "yellow"
                title = f"Yellow Card — {player} {minute}'"
                body = f"{home} vs {away}"
            elif "sub" in itype:
                mapped = "substitution"
                p_in = inc.get("player_in") or inc.get("related_player") or "Sub"
                title = f"Substitution {minute}'"
                body = f"IN: {p_in} | OUT: {player}"
            else:
                continue

            dispatch_match_alert(
                event_uid=uid,
                source="bsd",
                match_ref=eid_str,
                event_type=mapped,
                title=title,
                body=body,
                team_keys=team_keys,
                data=nav_data,
                player_name=player,
                minute=int(minute) if str(minute).isdigit() else None,
            )

        # Check if any previously dispatched BSD incident disappeared (VAR disallowed goal / rescinded card)
        prev_incs = _rows(
            _db()
            .table("dispatched_match_events")
            .select("event_uid, event_type, player_name, minute")
            .eq("source", "bsd")
            .eq("match_ref", eid_str)
            .eq("is_cancelled", False)
            .like("event_uid", f"bsd:{eid_str}:inc:%")
            .execute()
        )
        for prev in prev_incs:
            if prev["event_uid"] not in current_uids:
                p_name = prev.get("player_name") or "Player"
                p_min = f" ({prev['minute']}')" if prev.get("minute") is not None else ""
                etype = prev.get("event_type") or ""
                if etype == "goal":
                    t_txt = f"Goal Disallowed — {p_name}{p_min}"
                    b_txt = f"VAR overturned goal. Score is {score_str}."
                elif etype == "penalty_missed":
                    t_txt = f"Penalty Cancelled — {p_name}{p_min}"
                    b_txt = f"Decision overturned ({score_str})."
                elif etype in {"yellow", "red"}:
                    t_txt = f"{etype.title()} Card Cancelled — {p_name}{p_min}"
                    b_txt = f"Card rescinded ({home} vs {away})."
                else:
                    continue

                dispatch_reversal_alert(
                    original_event_uid=prev["event_uid"],
                    source="bsd",
                    match_ref=eid_str,
                    reversal_type=f"{etype}_cancelled",
                    title=t_txt,
                    body=b_txt,
                    team_keys=team_keys,
                    data=nav_data,
                    player_name=p_name,
                    minute=prev.get("minute"),
                )


def run_notification_tick() -> None:
    try:
        _check_local_reminders()
    except Exception as exc:
        log.warning("Local reminder check failed: %s", exc)
    try:
        _poll_bsd_live_events()
    except Exception as exc:
        log.warning("BSD live notification poll failed: %s", exc)