"""
app/routers/matches.py

GET /api/matches-by-date
Every match for one calendar day, played/live/upcoming, across every
league, grouped by league — backs the Matches tab's day-by-day
browsing.

GET /api/matches/{event_id}
The match detail screen's data source: Overview, Lineups, H2H, Facts,
Stats in one payload.
"""
import time
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException
from app.tactica import (
    get_match_ratings, get_frozen_ratings, is_freezable, freeze_ratings,
)
from app.config import bsd_get, cache_read, cache_write, cache_age, get_league_id_map, extract_league_name, debug_field

router = APIRouter()
MATCH_TTL = 60  # seconds for live/upcoming matches; finished matches could cache much longer


def _today_str() -> str:
    return datetime.now(timezone(timedelta(hours=1))).strftime("%Y-%m-%d")


def _extract_events(data) -> list[dict]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if "events" in data:
            return data.get("events") or []
        if "results" in data:
            return data.get("results") or []
    return []


@router.get("/matches-by-date")
def matches_by_date(date: str):
    try:
        datetime.strptime(date, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")

    ttl = MATCH_TTL if date == _today_str() else 86400
    cache_key = f"matches_by_date__bsd_v6__{date}"
    cached = cache_read(cache_key)
    is_cached = bool(cached and cache_age(cached) < ttl)

    if is_cached:
        bsd_leagues = cached.get("leagues", [])
        bsd_count = cached.get("count", 0)
        sample = cached.get("_debug_sample_event")
    else:
        data = bsd_get("/events/", params={"date_from": date, "date_to": date, "limit": 500})
        if data is None and cached:
            bsd_leagues = cached.get("leagues", [])
            bsd_count = cached.get("count", 0)
            sample = cached.get("_debug_sample_event")
            is_cached = True
        elif data is None:
            bsd_leagues = []
            bsd_count = 0
            sample = None
        else:
            events = _extract_events(data)
            league_map = get_league_id_map()
            by_league: dict[tuple, list] = {}
            for ev in events:
                league = extract_league_name(ev, league_map)
                league_id = ev.get("league_id") or ev.get("tournament_id") or ev.get("competition_id")
                by_league.setdefault((league_id, league), []).append({
                    "event_id": ev.get("id"),
                    "home_team": ev.get("home_team", ""),
                    "home_team_id": ev.get("home_team_id"),
                    "away_team": ev.get("away_team", ""),
                    "away_team_id": ev.get("away_team_id"),
                    "home_score": ev.get("home_score"),
                    "away_score": ev.get("away_score"),
                    "minute": ev.get("current_minute") or 0,
                    "status": ev.get("status", "notstarted"),
                    "kickoff": ev.get("event_date", ""),
                })

            league_order = {
                "Premier League": 1, "Champions League": 2, "Europa League": 3,
                "La Liga": 4, "Serie A": 5, "Bundesliga": 6, "Ligue 1": 7,
                "MLS": 8, "Eredivisie": 9, "Primeira Liga": 10, "Championship": 11,
            }
            bsd_leagues = [
                {"league_id": k[0], "league": k[1], "matches": v}
                for k, v in by_league.items()
            ]
            bsd_leagues.sort(key=lambda x: (league_order.get(x["league"], 999), x["league"]))
            bsd_count = len(events)
            sample = debug_field(events[0] if events else None)
            cache_write(cache_key, {
                "_cached_at": time.time(),
                "count": bsd_count,
                "leagues": bsd_leagues,
                "_debug_sample_event": sample,
            })

    local = _local_leagues(date)
    return {
        "_cached_at": time.time(),
        "date": date,
        "count": bsd_count + sum(len(g["matches"]) for g in local),
        "leagues": local + bsd_leagues,
        "_debug_sample_event": sample,
        "cached": is_cached,
    }


def _local_leagues(date: str) -> list[dict]:
    """Approved local competitions with fixtures on this date, shaped
    exactly like a BSD league group."""
    from app.routers.editor import _db, _rows

    try:
        start = f"{date}T00:00:00+01:00"
        end = f"{date}T23:59:59.999+01:00"
        fixtures = _rows(
            _db().table("fixtures")
            .select("id, tournament_id, kickoff_at, status, round, group_name, "
                    "home_team_id, away_team_id, home_score, away_score")
            .gte("kickoff_at", start).lte("kickoff_at", end)
            .order("kickoff_at").execute()
        )
        if not fixtures:
            return []

        t_ids = sorted({f["tournament_id"] for f in fixtures})
        tournaments = {
            t["id"]: t
            for t in _rows(
                _db().table("tournaments").select("id, name, status")
                .in_("id", t_ids).eq("status", "approved").execute()
            )
        }
        if not tournaments:
            return []

        teams = {
            r["id"]: (r.get("clubs") or {})
            for r in _rows(
                _db().table("tournament_teams")
                .select("id, tournament_id, clubs(id, name, crest_url)")
                .in_("tournament_id", list(tournaments)).execute()
            )
        }

        by_t: dict[str, list] = {}
        for fx in fixtures:
            t = tournaments.get(fx["tournament_id"])
            if not t:
                continue
            home = teams.get(fx["home_team_id"], {})
            away = teams.get(fx["away_team_id"], {})
            by_t.setdefault(fx["tournament_id"], []).append({
                "event_id":      fx["id"],
                "home_team":     home.get("name") or "Unknown",
                "home_team_id":  fx["home_team_id"],
                "home_crest":    home.get("crest_url"),
                "away_team":     away.get("name") or "Unknown",
                "away_team_id":  fx["away_team_id"],
                "away_crest":    away.get("crest_url"),
                "home_score":    fx.get("home_score"),
                "away_score":    fx.get("away_score"),
                "minute":        0,
                "status":        fx.get("status") or "scheduled",
                "kickoff":       fx.get("kickoff_at") or "",
                "source":        "local",
                "tournament_id": fx["tournament_id"],
            })

        return [
            {
                "league_id": None,
                "league": tournaments[tid]["name"],
                "source": "local",
                "tournament_id": tid,
                "matches": rows,
            }
            for tid, rows in by_t.items()
        ]
    except Exception:
        return []


def _lookup_name(resource: str, obj_id) -> str | None:
    if obj_id is None:
        return None
    data = bsd_get(f"/{resource}/{obj_id}/")
    if not data:
        return None
    return data.get("name")


def _h2h(event_id: int) -> dict:
    data = bsd_get(f"/events/{event_id}/h2h/")
    if not data:
        return {"summary": None, "recent_matches": []}
    recent = []
    for m in (data.get("recent_matches") or [])[:5]:
        eid = m.get("event_id")
        ev_data = bsd_get(f"/events/{eid}/") if eid else {}
        league_id = ev_data.get("league_id") if isinstance(ev_data, dict) else None
        league_name = None
        if league_id is not None:
            _lm = get_league_id_map()
            league_name = _lm.get(league_id) or _lm.get(str(league_id))

        recent.append({
            "event_id":     eid,
            "date":         m.get("date", ""),
            "home_team":    m.get("home", ""),
            "away_team":    m.get("away", ""),
            "home_team_id": m.get("home_team_id"),
            "away_team_id": m.get("away_team_id"),
            "home_score":   m.get("home_score"),
            "away_score":   m.get("away_score"),
            "league_id":    league_id,
            "league_name":  league_name,
        })
    return {
        "summary": {
            "total_matches": data.get("total_matches"),
            "home_wins":     data.get("home_wins"),
            "draws":         data.get("draws"),
            "away_wins":     data.get("away_wins"),
            "home_goals":    data.get("home_goals"),
            "away_goals":    data.get("away_goals"),
        },
        "recent_matches": recent,
    }


def _extract_incidents(event_id: int) -> list[dict]:
    data = bsd_get(f"/events/{event_id}/incidents/")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return data.get("events") or data.get("incidents") or data.get("results") or []
    return []


def _extract_goalscorers(incidents: list[dict]) -> list[dict]:
    out = []
    for inc in incidents:
        itype = str(inc.get("type") or inc.get("incident_type") or "").lower()
        if "goal" not in itype:
            continue
        if inc.get("rescinded") is True:
            continue
        minute = inc.get("minute")
        if minute is None:
            secs = inc.get("period_second")
            if isinstance(secs, (int, float)):
                minute = int(secs // 60)
        is_home = inc.get("is_home")
        out.append({
            "minute": minute,
            "player": inc.get("player") or inc.get("player_name") or inc.get("scorer"),
            "side":   inc.get("side") or inc.get("team_side") or ("home" if is_home is True else "away" if is_home is False else None),
        })
    return out


def _recent_form(team_id, exclude_event_id: int | None = None, limit: int = 5) -> list[dict]:
    if team_id is None:
        return []
    data = bsd_get(f"/events/", params={"team_id": team_id, "limit": 40})
    if not data:
        return []
    fixtures = data if isinstance(data, list) else (data.get("events") or data.get("results") or data.get("fixtures") or [])
    fixtures = sorted(fixtures, key=lambda x: x.get("event_date", ""), reverse=True)

    out = []
    for fx in fixtures:
        if len(out) >= limit:
            break
        status = str(fx.get("status", "")).lower()
        if status not in ["finished", "ended", "played", "ft"]:
            continue
        if exclude_event_id is not None and fx.get("id") == exclude_event_id:
            continue
        is_home    = fx.get("home_team_id") == team_id
        home_score = fx.get("home_score")
        away_score = fx.get("away_score")
        own_score  = home_score if is_home else away_score
        opp_score  = away_score if is_home else home_score
        result = None
        if own_score is not None and opp_score is not None:
            result = "W" if own_score > opp_score else "L" if own_score < opp_score else "D"
        out.append({
            "event_id":    fx.get("id"),
            "opponent":    (fx.get("away_team") if is_home else fx.get("home_team")) or "",
            "opponent_id": (fx.get("away_team_id") if is_home else fx.get("home_team_id")),
            "own_score":   own_score,
            "opp_score":   opp_score,
            "is_home":     is_home,
            "result":      result,
            "date":        fx.get("event_date", ""),
        })
        if len(out) >= limit:
            break
    return out


_FINISHED = {"finished", "ended", "played", "ft"}


def _parse_kickoff(raw) -> datetime | None:
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _empty_facts(reason: str) -> dict:
    side = {"attack": None, "defence": None, "win_prob": None, "live_rating": False}
    return {
        "home": dict(side), "away": dict(side),
        "draw_prob": None, "best_formation": None, "away_best_formation": None,
        "degraded": True, "name_mismatch": None,
        "frozen": False, "provisional": False,
        "unavailable_reason": reason,
    }


@router.get("/matches/{event_id}/facts")
def match_facts(event_id: int):
    """Tactica ATK/DEF + win probability for one fixture.

    Option B — Live Mirror Before Kickoff, Frozen at Kickoff:
      1. Before kickoff (status not finished and now < kickoff):
         Always pulls the latest live numbers from the main Tactica
         backend (app.tacticaengine.com) so both apps stay 100% identical
         right up until kickoff.
      2. At or after kickoff (now >= kickoff or status finished):
         Returns the stored snapshot if one exists; otherwise captures
         and freezes the kickoff-time numbers once so post-match results
         never rewrite pre-match probabilities.
    """
    base = bsd_get(f"/events/{event_id}/")
    if not base:
        frozen = get_frozen_ratings(event_id)
        if frozen:
            return frozen
        raise HTTPException(status_code=404, detail="Match not found")

    home_team = base.get("home_team")
    away_team = base.get("away_team")
    kickoff   = _parse_kickoff(base.get("event_date"))
    now       = datetime.now(timezone.utc)
    status    = str(base.get("status") or "").lower()

    started_or_finished = status in _FINISHED or (kickoff is not None and now >= kickoff)

    if started_or_finished:
        frozen = get_frozen_ratings(event_id)
        if frozen:
            return frozen
        if status in _FINISHED:
            return _empty_facts("no_prematch_snapshot")
        # Just kicked off without a snapshot yet: capture & freeze once now
        result = get_match_ratings(home_team, away_team)
        if is_freezable(result):
            kickoff_iso = kickoff.isoformat() if kickoff else now.isoformat()
            stored = freeze_ratings(event_id, home_team, away_team, kickoff_iso, result)
            if stored:
                return stored
        result["frozen"] = False
        result["provisional"] = False
        return result

    # Before kickoff: always mirror main Tactica backend live
    result = get_match_ratings(home_team, away_team)
    result["frozen"] = False
    result["provisional"] = True
    return result


@router.get("/matches/{event_id}")
def match_detail(event_id: int):
    cache_key = f"match__v4__{event_id}"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < MATCH_TTL:
        cached["cached"] = True
        return cached

    base = bsd_get(f"/events/{event_id}/")
    if base is None:
        raise HTTPException(status_code=404,
            detail=f"Event {event_id} not found, or /events/{{id}}/ isn't the real BSD path.")

    home_team  = base.get("home_team", "")
    away_team  = base.get("away_team", "")
    home_id    = base.get("home_team_id")
    away_id    = base.get("away_team_id")
    league_map = get_league_id_map()

    lineup_data   = bsd_get(f"/events/{event_id}/lineups/") or {}
    lineup_status = lineup_data.get("lineup_status", "unavailable")
    lineups       = lineup_data.get("lineups") or {}

    incidents    = _extract_incidents(event_id)
    h2h          = _h2h(event_id)
    stats        = bsd_get(f"/events/{event_id}/stats/")
    availability = bsd_get(f"/events/{event_id}/availability/") or {}
    home_form    = _recent_form(home_id, exclude_event_id=event_id)
    away_form    = _recent_form(away_id, exclude_event_id=event_id)

    result = {
        "_cached_at":  time.time(),
        "event_id":    event_id,
        "home_team":   home_team,
        "home_team_id": home_id,
        "away_team":   away_team,
        "away_team_id": away_id,
        "home_score":  base.get("home_score"),
        "away_score":  base.get("away_score"),
        "status":      base.get("status", "notstarted"),
        "event_date":  base.get("event_date", ""),
        "competition": extract_league_name(base, league_map),
        "venue":       _lookup_name("venues", base.get("venue_id")),
        "referee":     _lookup_name("referees", base.get("referee_id")),
        "round":       base.get("round_label") or base.get("round_name") or base.get("round_number"),
        "home_coach":  _lookup_name("managers", base.get("home_coach_id")),
        "away_coach":  _lookup_name("managers", base.get("away_coach_id")),
        "home_form":     home_form,
        "away_form":     away_form,
        "goalscorers":   _extract_goalscorers(incidents),
        "incidents":     incidents,
        "lineup_status": lineup_status,
        "lineups":       lineups,
        "h2h":           h2h,
        "stats":         stats,
        "availability":  (availability or {}).get("available") or {},
        "facts_url": f"/api/matches/{event_id}/facts",
        "_debug_base_keys": debug_field(list(base.keys())),
        "_debug_incidents_sample": debug_field(incidents[0] if incidents else None),
        "cached": False,
    }
    cache_write(cache_key, result)
    return result