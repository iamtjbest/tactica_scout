"""
app/routers/editor_fixtures.py

Fixtures and live match events: the pitchside half of the editor.

Fixture generation covers the three formats in the schema enum:
  league           round robin, every team plays every other once
  knockout         single-elimination bracket
  groups_knockout  round robin inside each group; the bracket is made
                   later from the group tables, not up front

Live entry is deliberately two separate things:
  PATCH .../score   the number on the scoreboard
  POST  .../events  who scored, who was booked, who came off
Keeping them apart means a scorer can correct a score without deleting
goal events, and can log a goal without being forced to recompute the
score in their head. The score is never derived from events, because a
match can be 2-1 with nobody having entered a scorer yet, and a half
empty event log must not quietly rewrite the result.
"""
import itertools
import random
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import require_user
from app.routers.editor import _db, _rows, _one, _owned_tournament, _require_editable

router = APIRouter()

# Mirrors the fixture_status enum in schema.sql.
LIVE_STATUSES     = {"live", "ht"}
FINISHED_STATUSES = {"ft"}

EVENT_TYPES = {
    "goal", "own_goal", "penalty_scored", "penalty_missed",
    "yellow", "second_yellow", "red", "substitution",
}

# Event types that put the ball in the net FOR the team credited.
# own_goal is deliberately absent: it counts for the opposition, and
# that asymmetry is the single easiest thing to get wrong here.
SCORING_EVENTS = {"goal", "penalty_scored"}


# ── models ────────────────────────────────────────────────────────────

class GenerateIn(BaseModel):
    """Kickoff times are laid out on a simple grid. Organisers almost
    always move them afterwards, so this is a starting point, not a
    scheduler."""
    first_kickoff: datetime
    minutes_between: int = Field(default=120, ge=30, le=1440)
    matches_per_day: int = Field(default=4, ge=1, le=20)
    venue: str | None = None
    double_round: bool = False       # league only: home and away
    shuffle: bool = True             # vary the order rather than alphabetical


class FixtureIn(BaseModel):
    home_team_id: str
    away_team_id: str
    kickoff_at: datetime
    round: str | None = None
    group_name: str | None = None
    venue: str | None = None


class FixturePatch(BaseModel):
    kickoff_at: datetime | None = None
    venue: str | None = None
    round: str | None = None
    status: str | None = None


class ScoreIn(BaseModel):
    home_score: int | None = Field(default=None, ge=0, le=99)
    away_score: int | None = Field(default=None, ge=0, le=99)
    ht_home_score: int | None = Field(default=None, ge=0, le=99)
    ht_away_score: int | None = Field(default=None, ge=0, le=99)
    status: str | None = None


class EventIn(BaseModel):
    tournament_team_id: str
    type: str
    player_id: str | None = None
    related_player_id: str | None = None      # assist, or the player coming on
    minute: int | None = Field(default=None, ge=0, le=130)


# ── helpers ───────────────────────────────────────────────────────────

def _fixture_with_tournament(fixture_id: str, user: dict) -> tuple[dict, dict]:
    """Load a fixture and prove the caller owns its tournament."""
    fx = _one(
        _db().table("fixtures").select("*").eq("id", fixture_id).limit(1).execute()
    )
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found")
    t = _owned_tournament(fx["tournament_id"], user)
    return fx, t


def _teams(tournament_id: str) -> list[dict]:
    return _rows(
        _db().table("tournament_teams")
        .select("id, group_name, clubs(name)")
        .eq("tournament_id", tournament_id).execute()
    )


def _round_robin(team_ids: list[str], double: bool) -> list[tuple[str, str]]:
    """Every team plays every other once, home/away alternating so one
    side isn't always at home. With `double`, the reverse fixture is
    appended as a second half of the season."""
    pairs = [(a, b) for i, a in enumerate(team_ids) for b in team_ids[i + 1:]]
    out: list[tuple[str, str]] = []
    for idx, (a, b) in enumerate(pairs):
        out.append((a, b) if idx % 2 == 0 else (b, a))
    if double:
        out += [(b, a) for (a, b) in out]
    return out


def _knockout_round_one(team_ids: list[str]) -> list[tuple[str, str]]:
    """First round of a single-elimination bracket.

    A field that isn't a power of two gives some teams a bye. Byes are
    NOT fabricated as fixtures against a phantom opponent -- they're
    simply left out of round one, and those teams enter in round two.
    The response says who they are so the organiser can see it.
    """
    n = len(team_ids)
    size = 1
    while size < n:
        size *= 2
    byes = size - n
    playing = team_ids[byes:] if byes else team_ids
    return [(playing[i], playing[i + 1]) for i in range(0, len(playing) - 1, 2)]


def _schedule(pairs: list[tuple[str, str]], opts: GenerateIn) -> list[datetime]:
    """Spread kickoffs across days: matches_per_day on the grid, then
    jump to the same time the next day."""
    times: list[datetime] = []
    start = opts.first_kickoff
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    for i in range(len(pairs)):
        day, slot = divmod(i, opts.matches_per_day)
        times.append(start + timedelta(days=day, minutes=slot * opts.minutes_between))
    return times


# ── generation ────────────────────────────────────────────────────────

@router.post("/editor/tournaments/{tournament_id}/fixtures/generate", status_code=201)
def generate_fixtures(tournament_id: str, body: GenerateIn,
                      user: dict = Depends(require_user)):
    """Build the fixture list from the teams already entered.

    Refuses if fixtures exist. Regenerating silently would wipe results
    that have already been played, so clearing them is an explicit act.
    """
    t = _owned_tournament(tournament_id, user)
    _require_editable(t)

    existing = _rows(
        _db().table("fixtures").select("id").eq("tournament_id", tournament_id)
        .limit(1).execute()
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="Fixtures already exist. Delete them first if you want to regenerate.",
        )

    teams = _teams(tournament_id)
    if len(teams) < 2:
        raise HTTPException(status_code=400, detail="Add at least two teams first")

    fmt = t["format"]
    rows: list[dict] = []
    notes: list[str] = []

    if fmt == "league":
        ids = [x["id"] for x in teams]
        if body.shuffle:
            random.shuffle(ids)
        pairs = _round_robin(ids, body.double_round)
        times = _schedule(pairs, body)
        rows = [{
            "tournament_id": tournament_id,
            "home_team_id":  h, "away_team_id": a,
            "kickoff_at":    times[i].isoformat(),
            "venue":         body.venue,
            "round":         f"Matchday {i // max(1, len(ids) // 2) + 1}",
        } for i, (h, a) in enumerate(pairs)]

    elif fmt == "knockout":
        ids = [x["id"] for x in teams]
        if body.shuffle:
            random.shuffle(ids)
        pairs = _knockout_round_one(ids)
        byes = len(ids) - (len(pairs) * 2)
        if byes:
            bye_names = [
                (x.get("clubs") or {}).get("name", "?")
                for x in teams if x["id"] in ids[:byes]
            ]
            notes.append(
                f"{byes} team(s) have a bye and enter in round 2: {', '.join(bye_names)}"
            )
        times = _schedule(pairs, body)
        rows = [{
            "tournament_id": tournament_id,
            "home_team_id":  h, "away_team_id": a,
            "kickoff_at":    times[i].isoformat(),
            "venue":         body.venue,
            "round":         "Round 1",
        } for i, (h, a) in enumerate(pairs)]

    elif fmt == "groups_knockout":
        grouped: dict[str, list[str]] = {}
        for x in teams:
            g = x.get("group_name")
            if not g:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Every team needs a group_name before generating a "
                        "groups + knockout tournament."
                    ),
                )
            grouped.setdefault(g, []).append(x["id"])

        thin = [g for g, ids in grouped.items() if len(ids) < 2]
        if thin:
            raise HTTPException(
                status_code=400,
                detail=f"These groups have fewer than two teams: {', '.join(sorted(thin))}",
            )

        all_pairs: list[tuple[str, str, str]] = []
        for g in sorted(grouped):
            ids = grouped[g]
            if body.shuffle:
                random.shuffle(ids)
            for (h, a) in _round_robin(ids, body.double_round):
                all_pairs.append((h, a, g))
        times = _schedule([(h, a) for h, a, _ in all_pairs], body)
        rows = [{
            "tournament_id": tournament_id,
            "home_team_id":  h, "away_team_id": a,
            "group_name":    g,
            "kickoff_at":    times[i].isoformat(),
            "venue":         body.venue,
            "round":         "Group stage",
        } for i, (h, a, g) in enumerate(all_pairs)]
        # The bracket is built from the final group tables, not now.
        notes.append(
            "Group fixtures created. Knockout rounds are added once the group "
            "tables are final."
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unknown format '{fmt}'")

    created = _rows(_db().table("fixtures").insert(rows).execute())
    return {"created": len(created), "fixtures": created, "notes": notes}


@router.post("/editor/tournaments/{tournament_id}/fixtures", status_code=201)
def add_fixture(tournament_id: str, body: FixtureIn,
                user: dict = Depends(require_user)):
    """Add one fixture by hand. Also how knockout rounds after the first
    get created, once the organiser knows who advanced."""
    _owned_tournament(tournament_id, user)
    if body.home_team_id == body.away_team_id:
        raise HTTPException(status_code=400, detail="A team cannot play itself")

    ids = {x["id"] for x in _teams(tournament_id)}
    for tid in (body.home_team_id, body.away_team_id):
        if tid not in ids:
            raise HTTPException(status_code=400, detail=f"Team {tid} is not in this tournament")

    created = _one(_db().table("fixtures").insert({
        "tournament_id": tournament_id,
        "home_team_id":  body.home_team_id,
        "away_team_id":  body.away_team_id,
        "kickoff_at":    body.kickoff_at.isoformat(),
        "round":         body.round,
        "group_name":    body.group_name,
        "venue":         body.venue,
    }).execute())
    return created


@router.delete("/editor/tournaments/{tournament_id}/fixtures", status_code=200)
def clear_fixtures(tournament_id: str, user: dict = Depends(require_user)):
    """Delete every fixture, so the list can be regenerated.

    Refused once any match has been played. Those results are the
    tournament's history and a regenerate must not quietly erase them.
    """
    t = _owned_tournament(tournament_id, user)
    _require_editable(t)

    played = _rows(
        _db().table("fixtures").select("id, status")
        .eq("tournament_id", tournament_id)
        .in_("status", list(FINISHED_STATUSES | LIVE_STATUSES))
        .limit(1).execute()
    )
    if played:
        raise HTTPException(
            status_code=409,
            detail="Some matches have already been played or are live. Delete those individually.",
        )
    _db().table("fixtures").delete().eq("tournament_id", tournament_id).execute()
    return {"cleared": True}


@router.patch("/editor/fixtures/{fixture_id}")
def update_fixture(fixture_id: str, body: FixturePatch,
                   user: dict = Depends(require_user)):
    """Move a kickoff, change the venue, postpone it."""
    _fixture_with_tournament(fixture_id, user)
    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "kickoff_at" in patch:
        patch["kickoff_at"] = patch["kickoff_at"].isoformat()
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update")
    updated = _one(_db().table("fixtures").update(patch).eq("id", fixture_id).execute())
    return updated


@router.delete("/editor/fixtures/{fixture_id}", status_code=204)
def delete_fixture(fixture_id: str, user: dict = Depends(require_user)):
    _fixture_with_tournament(fixture_id, user)
    _db().table("fixtures").delete().eq("id", fixture_id).execute()
    return None


# ── live scoring ──────────────────────────────────────────────────────

@router.patch("/editor/fixtures/{fixture_id}/score")
def set_score(fixture_id: str, body: ScoreIn, user: dict = Depends(require_user)):
    """Set the scoreboard.

    Separate from events on purpose. A scorer pitchside needs to fix a
    wrong score in one tap without touching the goal log, and needs to
    be able to put a score up before anyone has keyed in who scored.
    """
    _fixture_with_tournament(fixture_id, user)

    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if not patch:
        raise HTTPException(status_code=400, detail="Nothing to update")

    status = patch.get("status")
    if status is not None and status not in {
        "scheduled", "live", "ht", "ft", "postponed", "cancelled"
    }:
        raise HTTPException(status_code=400, detail=f"Unknown status '{status}'")

    # A finished match needs a result. Marking ft with an empty
    # scoreboard produces a fixture that looks played and says nothing.
    if status == "ft":
        fx = _one(_db().table("fixtures").select("home_score, away_score")
                  .eq("id", fixture_id).limit(1).execute()) or {}
        home = patch.get("home_score", fx.get("home_score"))
        away = patch.get("away_score", fx.get("away_score"))
        if home is None or away is None:
            raise HTTPException(
                status_code=400,
                detail="Set both scores before marking the match finished.",
            )

    updated = _one(_db().table("fixtures").update(patch).eq("id", fixture_id).execute())
    return updated


@router.get("/editor/fixtures/{fixture_id}/events")
def list_events(fixture_id: str, user: dict = Depends(require_user)):
    _fixture_with_tournament(fixture_id, user)
    rows = _rows(
        _db().table("match_events")
        .select("*, players!match_events_player_id_fkey(id, first_name, last_name)")
        .eq("fixture_id", fixture_id)
        .order("minute")
        .execute()
    )
    return {"count": len(rows), "events": rows}


@router.post("/editor/fixtures/{fixture_id}/events", status_code=201)
def add_event(fixture_id: str, body: EventIn, user: dict = Depends(require_user)):
    """Log a goal, card or substitution.

    Does NOT touch the score. The response carries `score_from_events`
    so the UI can show "events say 2-1, scoreboard says 2-0" and let a
    human decide, rather than this endpoint silently overwriting a
    result the referee gave.
    """
    fx, t = _fixture_with_tournament(fixture_id, user)

    if body.type not in EVENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown event type. One of: {', '.join(sorted(EVENT_TYPES))}",
        )
    if body.tournament_team_id not in {fx["home_team_id"], fx["away_team_id"]}:
        raise HTTPException(status_code=400, detail="That team is not playing in this fixture")
    if body.type == "substitution" and not (body.player_id and body.related_player_id):
        raise HTTPException(
            status_code=400,
            detail="A substitution needs player_id (off) and related_player_id (on).",
        )

    created = _one(_db().table("match_events").insert({
        "fixture_id":         fixture_id,
        "tournament_team_id": body.tournament_team_id,
        "player_id":          body.player_id,
        "related_player_id":  body.related_player_id,
        "type":               body.type,
        "minute":             body.minute,
        "created_by":         user["id"],
    }).execute())

    return {
        "event": created,
        "score_from_events": _score_from_events(fixture_id, fx),
        "scoreboard": {"home": fx.get("home_score"), "away": fx.get("away_score")},
    }


@router.delete("/editor/fixtures/{fixture_id}/events/{event_id}", status_code=204)
def delete_event(fixture_id: str, event_id: str, user: dict = Depends(require_user)):
    _fixture_with_tournament(fixture_id, user)
    _db().table("match_events").delete() \
        .eq("id", event_id).eq("fixture_id", fixture_id).execute()
    return None


def _score_from_events(fixture_id: str, fx: dict) -> dict:
    """What the event log alone implies the score is.

    Offered for comparison, never written to the fixture. An own goal
    counts for the OTHER side, which is the one rule worth stating out
    loud because getting it backwards is silent and plausible.
    """
    events = _rows(
        _db().table("match_events").select("type, tournament_team_id")
        .eq("fixture_id", fixture_id).execute()
    )
    home_id, away_id = fx["home_team_id"], fx["away_team_id"]
    home = away = 0
    for e in events:
        credited = e["tournament_team_id"]
        if e["type"] in SCORING_EVENTS:
            scorer = credited
        elif e["type"] == "own_goal":
            scorer = away_id if credited == home_id else home_id
        else:
            continue
        if scorer == home_id:
            home += 1
        else:
            away += 1
    return {"home": home, "away": away}
