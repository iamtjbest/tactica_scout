import time
from fastapi import APIRouter, HTTPException
from app.config import bsd_get, cache_read, cache_write, cache_age, get_league_id_map, get_league_country_map, extract_league_name

router = APIRouter()
# 5 min. Squad availability is refreshed several times a day per BSD's
# docs, so an hour was stale by design -- and a bad fetch used to stick
# around for the whole hour.
TEAM_TTL = 300
# 2 min. Scores move. Half an hour meant a team page could show a stale
# result long after the match finished.
FIXTURES_TTL = 120
# When a BSD sub-call came back empty we still answer, but we only hold
# that answer for a minute so the gap heals itself instead of sticking
# around for the full TTL.
DEGRADED_TTL = 60

FINISHED_STATUSES = {"finished", "ended", "played", "ft"}


def _parse_date(ev: dict):
    d = ev.get("event_date") or ""
    return d  # ISO strings sort correctly as plain strings


@router.get("/teams/{team_id}")
def team_detail(team_id: int):
    cache_key = f"team_detail__v2__{team_id}"
    cached = cache_read(cache_key)
    if cached:
        ttl = DEGRADED_TTL if cached.get("degraded") else TEAM_TTL
        if cache_age(cached) < ttl:
            cached["cached"] = True
            return cached

    profile = bsd_get(f"/teams/{team_id}/")
    if profile is None:
        if cached:
            cached["cached"] = True
            cached["stale"] = True
            return cached
        raise HTTPException(status_code=404, detail="Team not found in BSD API")

    squad_data = bsd_get(f"/teams/{team_id}/squad/")
    squad = squad_data.get("players", []) if squad_data else []

    venue_id = profile.get("venue_id")
    venue_info = None
    if venue_id:
        venue_info = bsd_get(f"/venues/{venue_id}/")

    managers_data = bsd_get(f"/managers/", params={"team_id": team_id})
    manager_info = None
    if managers_data and managers_data.get("results") and len(managers_data["results"]) > 0:
        manager_info = managers_data["results"][0]

    # Deduce the team's DOMESTIC league out of its fixture list.
    #
    # The old approach took the league_id of the first fixture found in
    # the next 5 -- which happily reported Champions League as a Premier
    # League club's "primary league" whenever the next match chronologically
    # was a European night. Fixed by matching each candidate league's own
    # country (from /leagues/, via get_league_country_map) against the
    # team's own country field. A continental competition's country on BSD
    # is the confederation/region, not a national name, so it won't match
    # and gets skipped in favour of the actual domestic league.
    fixtures_data = bsd_get(f"/teams/{team_id}/fixtures/", params={"limit": 20})
    team_country = profile.get("country") or ""
    league_country_map = get_league_country_map() if team_country else {}

    candidate_league_ids = []
    if fixtures_data and isinstance(fixtures_data, dict) and "results" in fixtures_data:
        for fx in fixtures_data["results"]:
            lid = fx.get("league_id")
            if lid is not None and lid not in candidate_league_ids:
                candidate_league_ids.append(lid)

    primary_league_id = None
    for lid in candidate_league_ids:
        if team_country and league_country_map.get(lid) == team_country:
            primary_league_id = lid
            break
    if primary_league_id is None and candidate_league_ids:
        # No country match (team_country missing, or BSD's country
        # strings didn't line up) -- fall back to the old "first seen"
        # behaviour rather than showing nothing.
        primary_league_id = candidate_league_ids[0]

    primary_league_name = None
    position = None

    if primary_league_id:
        league_map = get_league_id_map()
        primary_league_name = league_map.get(primary_league_id) or league_map.get(str(primary_league_id))

        standings_data = bsd_get(f"/leagues/{primary_league_id}/standings/")
        if standings_data and isinstance(standings_data, dict) and "results" in standings_data:
            for s in standings_data["results"]:
                if s.get("team_id") == team_id:
                    position = s.get("position")
                    break

    result = {
        "_cached_at": time.time(),
        "id": profile.get("id"),
        "name": profile.get("name"),
        "short_name": profile.get("short_name"),
        "country": profile.get("country"),
        "venue": venue_info.get("name") if venue_info else None,
        "venue_capacity": venue_info.get("capacity") if venue_info else None,
        "manager_name": manager_info.get("name") if manager_info else None,
        "manager_stats": {
            "avg_possession": manager_info.get("avg_possession"),
            "avg_goals_scored": manager_info.get("avg_goals_scored"),
            "avg_goals_conceded": manager_info.get("avg_goals_conceded")
        } if manager_info else None,
        "primary_league_id": primary_league_id,
        "primary_league_name": primary_league_name,
        "position": position,
        "squad": squad,
        # True when at least one BSD sub-call came back empty. The client
        # can render "Not available" honestly, and the short TTL above
        # means we retry in a minute rather than in an hour.
        "degraded": not (squad and venue_info and manager_info),
        "cached": False,
    }
    cache_write(cache_key, result)
    return result


def _map_match(ev: dict, league_map: dict) -> dict:
    return {
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
        "competition":  extract_league_name(ev, league_map),
        "league_id":    ev.get("league_id"),
    }


@router.get("/teams/{team_id}/fixtures")
def team_fixtures(team_id: int):
    """Full season fixture list for a team, split into `recent` (finished,
    most recent first) and `upcoming` (not yet played, soonest first) so
    the Overview and Matches tabs don't have to guess at sort order or
    status strings themselves. `matches` is kept too (recent + upcoming,
    chronological) for anything still reading the old shape."""
    cache_key = f"team_fixtures__v2__{team_id}"
    cached = cache_read(cache_key)
    if cached:
        ttl = DEGRADED_TTL if cached.get("degraded") else FIXTURES_TTL
        if cache_age(cached) < ttl:
            cached["cached"] = True
            return cached

    data = bsd_get(f"/teams/{team_id}/fixtures/", params={"limit": 100})
    league_map = get_league_id_map()

    events = []
    if isinstance(data, dict) and "results" in data:
        events = data.get("results", [])
    elif isinstance(data, list):
        events = data

    recent = []
    upcoming = []
    for ev in events:
        status = (ev.get("status") or "").lower()
        mapped = _map_match(ev, league_map)
        if status in FINISHED_STATUSES:
            recent.append(mapped)
        else:
            upcoming.append(mapped)

    recent.sort(key=lambda m: m["kickoff"], reverse=True)   # most recent finished first
    upcoming.sort(key=lambda m: m["kickoff"])               # soonest first

    result = {
        "_cached_at": time.time(),
        "team_id": team_id,
        "recent": recent,
        "upcoming": upcoming,
        "matches": list(reversed(recent)) + upcoming,
        # No events at all means BSD gave us nothing, not that the club
        # has never played. Retry in a minute rather than caching the
        # emptiness for half an hour.
        "degraded": not events,
        "cached": False,
    }
    cache_write(cache_key, result)
    return result
