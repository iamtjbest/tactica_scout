"""
GET /api/leagues
List of competitions the Leagues tab lets you pick from.

GET /api/standings?league_id=1
The table for one competition.

BSD call: GET /api/v2/leagues/{id}/standings/?season_id=... -- confirmed
against the real Leagues, seasons & standings docs. Rows carry
position/team_id/team_name/played/won/drawn/lost/goals-for-against/
points/form. The docs' own JSON sample uses "pts" for points, not
"points" -- _row()'s widened guess already covers that, and goal_diff
falls back to goals_for - goals_against when BSD doesn't send one.

Cup-style competitions return a "groups" object (one table per group)
instead of a flat "standings" list -- confirmed directly from the
docs: "Cup-style competitions return groups array (one table per
group) instead of a single table -- handle both." standings() below
branches on that shape: a grouped response returns "groups":
[{group, standings}] and "standings": null; a flat one returns
"standings": [...] and "groups": null -- so the frontend can tell
"no data" apart from "wrong shape for this competition".
"""
import time
from fastapi import APIRouter, HTTPException
from app.config import bsd_get, cache_read, cache_write, cache_age, get_league_id_map, LEAGUE_NAMES

router = APIRouter()
# 5 min. Tables don't move outside matchdays, true -- but matchday is
# exactly when people look at them, and that's when an hour is worst.
STANDINGS_TTL = 300


@router.get("/leagues")
def list_leagues():
    league_map = get_league_id_map()
    return {
        "leagues": [
            {"league_id": lid, "name": league_map.get(lid, name)}
            for lid, name in LEAGUE_NAMES.items()
        ]
    }


def _fetch_standings_raw(league_id: int):
    data = bsd_get(f"/leagues/{league_id}/standings/")
    if data is not None:
        return data
    return bsd_get("/standings/", params={"league_id": league_id})


def _first_present(r: dict, *keys):
    """Return the first key that's actually present (not just falsy) in
    r, or None if none of them are. Distinct from `a or b or c`, which
    would wrongly skip a real value of 0."""
    for k in keys:
        if k in r and r[k] is not None:
            return r[k]
    return None


def _row(r: dict) -> dict:
    team = r.get("team_name")
    if team is None and isinstance(r.get("team"), dict):
        team = r["team"].get("name")

    goals_for     = _first_present(r, "goals_for", "goals_scored", "scored", "gf", "for") or 0
    goals_against = _first_present(r, "goals_against", "goals_conceded", "conceded", "ga", "against") or 0
    points        = _first_present(r, "points", "pts", "point") or 0
    goal_diff     = _first_present(r, "goal_difference", "goals_diff", "goal_diff", "gd")
    if goal_diff is None:
        goal_diff = goals_for - goals_against

    return {
        "position":      r.get("position") or r.get("rank"),
        "team":          team or "",
        "team_id":       r.get("team_id"),
        "played":        r.get("played") or r.get("matches_played") or 0,
        "won":           r.get("won") or r.get("wins") or 0,
        "drawn":         r.get("drawn") or r.get("draws") or 0,
        "lost":          r.get("lost") or r.get("losses") or 0,
        "goals_for":     goals_for,
        "goals_against": goals_against,
        "goal_diff":     goal_diff,
        "points":        points,
        "zone":          r.get("zone"),
    }


@router.get("/standings")
def standings(league_id: int):
    cache_key = f"standings__v2__{league_id}"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < STANDINGS_TTL:
        cached["cached"] = True
        return cached

    data = _fetch_standings_raw(league_id)
    if data is None:
        if cached:
            cached["cached"] = True
            cached["stale"]  = True
            return cached
        raise HTTPException(status_code=502,
            detail="BSD standings call failed on both the nested and flat path — confirm the real endpoint in Postman.")

    league_map  = get_league_id_map()
    league_name = league_map.get(league_id, LEAGUE_NAMES.get(league_id, "Unknown"))

    groups_raw = data.get("groups") if isinstance(data, dict) else None
    if isinstance(groups_raw, dict) and groups_raw:
        groups = [
            {"group": group_name, "standings": [_row(r) for r in (rows or [])]}
            for group_name, rows in groups_raw.items()
        ]
        sample = None
        for rows in groups_raw.values():
            if rows:
                sample = rows[0]
                break
        result = {
            "_cached_at":    time.time(),
            "league_id":     league_id,
            "league":        league_name,
            "standings":     None,
            "groups":        groups,
            "_debug_sample": sample,
            "cached":        False,
        }
        cache_write(cache_key, result)
        return result

    rows_raw = data if isinstance(data, list) else (data.get("results") or data.get("standings") or [])
    result = {
        "_cached_at":    time.time(),
        "league_id":     league_id,
        "league":        league_name,
        "standings":     [_row(r) for r in rows_raw],
        "groups":        None,
        "_debug_sample": rows_raw[0] if rows_raw else None,
        "cached":        False,
    }
    cache_write(cache_key, result)
    return result

@router.get("/leagues/{league_id}/fixtures")
def league_fixtures(league_id: int):
    cache_key = f"league_fixtures__v1__{league_id}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < STANDINGS_TTL:
        cached["cached"] = True
        return cached

    data = bsd_get("/events/", params={"league_id": league_id, "limit": 50})
    
    events = []
    if isinstance(data, dict) and "results" in data:
        events = data.get("results", [])
    elif isinstance(data, list):
        events = data
        
    matches = []
    for ev in events:
        matches.append({
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
        
    result = {
        "_cached_at": time.time(),
        "league_id": league_id,
        "matches": matches,
        "cached": False,
    }
    cache_write(cache_key, result)
    return result

@router.get("/leagues/{league_id}/top-stats")
def league_top_stats(league_id: int):
    cache_key = f"league_top_stats__{league_id}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < STANDINGS_TTL:
        cached["cached"] = True
        return cached

    scorers_data = bsd_get(f"/leagues/{league_id}/top/scorers/")
    assists_data = bsd_get(f"/leagues/{league_id}/top/assists/")

    scorers = []
    if scorers_data and isinstance(scorers_data, dict):
        scorers = scorers_data.get("leaders", [])
        
    assists = []
    if assists_data and isinstance(assists_data, dict):
        assists = assists_data.get("leaders", [])

    result = {
        "_cached_at": time.time(),
        "league_id": league_id,
        "scorers": scorers,
        "assists": assists,
        "cached": False,
    }
    cache_write(cache_key, result)
    return result
