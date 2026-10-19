"""
app/routers/matches.py

GET /api/matches-by-date
Every match for one calendar day, played/live/upcoming, across every
league, grouped by league — backs the Matches tab's day-by-day
browsing.

LEAGUE LABELING: almost every match was landing in a generic "Other"
bucket because the league-name/id field guess had no fallback. Now
goes through config.extract_league_name, which tries several spellings
and nested shapes. If it's STILL wrong, "_debug_sample_event" below
carries one raw event so the real field name can be read off a hit to
this endpoint directly.

GET /api/matches/{event_id}
The match detail screen's data source: Overview, Lineups, H2H, Facts,
Stats in one payload.

CONFIRMED 2026-10-08 against the real BSD docs (Events & live scores,
Managers/referees/venues, Competition structure):
  - league name is NEVER embedded on an event, only league_id -- always
    resolved through extract_league_name / the league id map.
  - venue_id / referee_id / home_coach_id / away_coach_id are ids only.
    Real names come from /venues/{id}/, /referees/{id}/, /managers/{id}/
    -- see _lookup_name below. Old code guessed a name field directly
    on the event, which was always going to come back empty.
  - round_label ("League phase - Matchday 5") is the ready-to-display
    string -- round_number repeats across stages (matchday 5 of league
    phase vs. round of 16) and round_name is usually blank, so neither
    should be shown alone.
  - H2H has its own endpoint, /events/{id}/h2h/, with a real summary
    (total_matches/home_wins/draws/away_wins/goals) plus recent_matches.
    Replaces the old fixture-filter-by-name fallback, which is gone.
  - Goalscorers come from /events/{id}/incidents/ (chronological goals/
    cards/subs/VAR), not a field on the event itself. Filtered here to
    goal-type entries. Exact minute/player field names inside each
    incident are still unconfirmed -- "_debug_incidents_sample" carries
    one raw entry so that can be nailed down from a real response.
  - Stats endpoint is /events/{id}/stats/, NOT /statistics/ -- the old
    path was never going to 200.
  - /events/{id}/availability/ tells us up front which sub-resources
    this match actually has data for, so the frontend can show an
    accurate "not published yet" message instead of guessing from an
    empty response.
"""
import time
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from app.config import bsd_get, cache_read, cache_write, cache_age, get_league_id_map, extract_league_name

router = APIRouter()
MATCH_TTL = 60  # seconds for live/upcoming matches; finished matches could cache much longer


def _today_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


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

    ttl       = MATCH_TTL if date == _today_str() else 86400
    cache_key = f"matches_by_date__v5__{date}"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < ttl:
        cached["cached"] = True
        return cached

    data = bsd_get("/events/", params={"date_from": date, "date_to": date, "limit": 500})
    if data is None:
        if cached:
            cached["cached"] = True
            cached["stale"]  = True
            return cached
        return {"_cached_at": time.time(), "date": date, "count": 0, "leagues": [], "cached": False,
                "error": "BSD API unreachable"}

    events     = _extract_events(data)
    league_map = get_league_id_map()

    by_league: dict[str, list] = {}
    for ev in events:
        league = extract_league_name(ev, league_map)
        league_id = ev.get("league_id") or ev.get("tournament_id") or ev.get("competition_id")
        group_key = (league_id, league)
        by_league.setdefault(group_key, []).append({
            "event_id":     ev.get("id"),
            "home_team":    ev.get("home_team", ""),
            "home_team_id": ev.get("home_team_id"),
            "away_team":    ev.get("away_team", ""),
            "away_team_id": ev.get("away_team_id"),
            "home_score":   ev.get("home_score"),
            "away_score":   ev.get("away_score"),
            "minute":       ev.get("current_minute") or 0,
            "status":       ev.get("status", "notstarted"),
            "kickoff":      ev.get("event_date", ""),
        })

    # Sort leagues by priority, then alphabetically
    league_order = {
        "Premier League": 1,
        "Champions League": 2,
        "Europa League": 3,
        "La Liga": 4,
        "Serie A": 5,
        "Bundesliga": 6,
        "Ligue 1": 7,
        "MLS": 8,
        "Eredivisie": 9,
        "Primeira Liga": 10,
        "Championship": 11
    }
    leagues_list = [{"league_id": k[0], "league": k[1], "matches": v} for k, v in by_league.items()]
    leagues_list.sort(key=lambda x: (league_order.get(x["league"], 999), x["league"]))

    result = {
        "_cached_at": time.time(),
        "date":       date,
        "count":      len(events),
        "leagues":    leagues_list,
        "_debug_sample_event": events[0] if events else None,
        "cached":     False,
    }
    cache_write(cache_key, result)
    return result


def _lookup_name(resource: str, obj_id) -> str | None:
    """GET /api/v2/{resource}/{obj_id}/ and read its 'name' field.
    Confirmed from the Managers, referees & venues docs that events
    only carry referee_id/venue_id/home_coach_id/away_coach_id -- never
    a name string -- so this one extra call per id is the only way to
    get something displayable."""
    if obj_id is None:
        return None
    data = bsd_get(f"/{resource}/{obj_id}/")
    if not data:
        return None
    return data.get("name")


def _h2h(event_id: int) -> dict:
    """GET /events/{id}/h2h/ -- a real, documented endpoint, not a
    guess. Returns a summary (wins/draws/goals) plus recent_matches.
    Docs are explicit: read home_score/away_score (nullable ints), not
    the "score" string, which turns a no-result meeting into a fake
    "0-0"."""
    data = bsd_get(f"/events/{event_id}/h2h/")
    if not data:
        return {"summary": None, "recent_matches": []}
    recent = []
    for m in (data.get("recent_matches") or [])[:5]:
        eid = m.get("event_id")
        ev_data = bsd_get(f"/events/{eid}/") if eid else {}
        league_id = ev_data.get("league_id") if isinstance(ev_data, dict) else None
        # BSD's event object has no nested `league` object -- only a
        # top-level league_id -- so the old ev_data["league"]["name"]
        # lookup was always None and the competition header never
        # rendered. Resolve from the cached id->name map instead, same
        # as everywhere else.
        league_name = None
        if league_id is not None:
            _lm = get_league_id_map()
            league_name = _lm.get(league_id) or _lm.get(str(league_id))
        
        recent.append({
            "event_id":   eid,
            "date":       m.get("date", ""),
            "home_team":  m.get("home", ""),
            "away_team":  m.get("away", ""),
            "home_team_id": m.get("home_team_id"),
            "away_team_id": m.get("away_team_id"),
            "home_score": m.get("home_score"),
            "away_score": m.get("away_score"),
            "league_id":  league_id,
            "league_name": league_name,
        })
    return {
        "summary": {
            "total_matches": data.get("total_matches"),
            "home_wins":      data.get("home_wins"),
            "draws":          data.get("draws"),
            "away_wins":      data.get("away_wins"),
            "home_goals":     data.get("home_goals"),
            "away_goals":     data.get("away_goals"),
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
    """Filters /incidents/ down to goal-type entries. Field names for
    minute/player/side inside each incident are still unconfirmed --
    tries the common spellings and falls back to period_second // 60
    for the minute. "_debug_incidents_sample" on the response carries
    one raw incident so this can be tightened once real data is seen."""
    out = []
    for inc in incidents:
        itype = str(inc.get("type") or inc.get("incident_type") or "").lower()
        if "goal" not in itype:
            continue
        if inc.get("rescinded") is True:
            continue  # overturned on review -- stays in the timeline but shouldn't count
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
    """Last N finished results for one team, independent of the other
    side in the current match -- same shape BSD's own fixtures list
    uses (home_team/away_team/home_score/away_score/home_team_id/
    away_team_id), confirmed from the Teams, players & transfers docs
    (GET /teams/{id}/fixtures/?status=&...). Powers the "Team form"
    strip on the Overview tab, same idea as FotMob's."""
    if team_id is None:
        return []
    # The BSD API /teams/{id}/fixtures/ does not exist. Use /events/?team_id= instead, and filter for finished matches.
    data = bsd_get(f"/events/", params={"team_id": team_id, "limit": 40})
    if not data:
        return []
    fixtures = data if isinstance(data, list) else (data.get("events") or data.get("results") or data.get("fixtures") or [])

    # Sort fixtures by date descending just in case they aren't
    fixtures = sorted(fixtures, key=lambda x: x.get("event_date", ""), reverse=True)

    out = []
    for fx in fixtures:
        if len(out) >= limit:
            break
        status = str(fx.get("status", "")).lower()
        if status not in ["finished", "ended", "played"]:
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
            "event_id":  fx.get("id"),
            "opponent":  (fx.get("away_team") if is_home else fx.get("home_team")) or "",
            "own_score": own_score,
            "opp_score": opp_score,
            "is_home":   is_home,
            "result":    result,
            "date":      fx.get("event_date", ""),
        })
        if len(out) >= limit:
            break
    return out


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
        "facts": {
            "tactica_atk_rating": None,
            "tactica_def_rating": None,
            "tactica_win_prob":   None,
        },
        "_debug_base_keys": list(base.keys()),
        "_debug_incidents_sample": incidents[0] if incidents else None,
        "cached": False,
    }
    cache_write(cache_key, result)
    return result
