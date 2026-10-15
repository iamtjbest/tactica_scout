"""
GET /api/live-scores
Home-screen feed: every live/upcoming/recent match BSD has right now,
grouped by league.

BSD call: GET /api/v2/events/live/
CONFIRMED field shape:
  { count, events: [{ home_team, away_team, home_score, away_score,
    current_minute, league_name, league_id?, status, last_updated, id? }] }

LEAGUE LABELING — widened 2026-10-08: now shares config.extract_league_name
with matches.py instead of a single unguarded field guess, same fix,
same reason (almost everything was landing in "Other").
"""
import time
from fastapi import APIRouter
from app.config import bsd_get, cache_read, cache_write, cache_age, get_league_id_map, extract_league_name

router = APIRouter()
LIVE_TTL = 30  # seconds — matches BSD's own Redis TTL, no point polling faster


@router.get("/live-scores")
def live_scores():
    cache_key = "live_scores__v3__all"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < LIVE_TTL:
        cached["cached"] = True
        return cached

    data = bsd_get("/events/live/")
    if data is None:
        if cached:
            cached["cached"] = True
            cached["stale"]  = True
            return cached
        return {"_cached_at": time.time(), "count": 0, "leagues": [], "cached": False,
                "error": "BSD API unreachable"}

    events     = data.get("events", [])
    league_map = get_league_id_map()

    by_league: dict[str, list] = {}
    for ev in events:
        league = extract_league_name(ev, league_map)
        by_league.setdefault(league, []).append({
            "event_id":     ev.get("id"),
            "home_team":    ev.get("home_team", ""),
            "away_team":    ev.get("away_team", ""),
            "home_score":   ev.get("home_score") or 0,
            "away_score":   ev.get("away_score") or 0,
            "minute":       ev.get("current_minute") or 0,
            "status":       ev.get("status", "notstarted"),
            "last_updated": ev.get("last_updated", ""),
        })

    result = {
        "_cached_at": time.time(),
        "count":      len(events),
        "leagues":    [{"league": k, "matches": v} for k, v in by_league.items()],
        "cached":     False,
    }
    cache_write(cache_key, result)
    return result
