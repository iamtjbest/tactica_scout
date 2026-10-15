"""
GET /api/players/search?name={query}
GET /api/players/{id}/seasons
GET /api/players/{id}/profile

Player search + the season dropdown the comparison screen needs before
it can show a radar. Both BSD calls here are CONFIRMED — proven against
the real Mohamed Salah response on 2026-10-08:
  GET /api/v2/players/?name={query}     (NOT ?search= — BSD 400s on that,
                                          confirmed accepted params are:
                                          limit, name, national_team_id,
                                          nationality_code, offset,
                                          position, team_id)
  GET /api/v2/players/{id}/stats/       (paginated, 50/page, does NOT
                                          carry a season field directly —
                                          see config.py season_label_from_date)
"""
import time
from fastapi import APIRouter, HTTPException, Query
from app.config import bsd_get, cache_read, cache_write, cache_age, season_label_from_date

router = APIRouter()
SEARCH_TTL  = 3600   # player identity doesn't change hour to hour
SEASONS_TTL = 3600
MAX_STATS_PAGES = 20  # 20 x 50 = up to 1000 matches walked per player; raise if a long career gets truncated


@router.get("/players/search")
def search_players(name: str = Query(..., min_length=2)):
    cache_key = f"player_search__{name.lower()}"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < SEARCH_TTL:
        cached["cached"] = True
        return cached

    data = bsd_get("/players/", params={"name": name, "limit": 20})
    if data is None:
        raise HTTPException(status_code=503, detail="BSD API unreachable.")

    results = []
    for p in data.get("results", []):
        results.append({
            "id":            p.get("id"),
            "name":          p.get("name"),
            "short_name":    p.get("short_name"),
            "position":      p.get("position"),
            "current_team":  (p.get("current_team") or {}).get("name"),
            "nationality":   p.get("nationality"),
            "rating":        p.get("rating"),
        })

    result = {"_cached_at": time.time(), "query": name, "results": results, "cached": False}
    cache_write(cache_key, result)
    return result


def _walk_all_stats(player_id: int) -> list[dict]:
    """Pull every page of /players/{id}/stats/ up to MAX_STATS_PAGES,
    cached as one blob so season filtering and radar aggregation don't
    re-paginate on every request."""
    cache_key = f"player_stats_raw__{player_id}"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < 3600:
        return cached["records"]

    records = []
    offset = 0
    limit  = 50
    for _ in range(MAX_STATS_PAGES):
        data = bsd_get(f"/players/{player_id}/stats/", params={"limit": limit, "offset": offset})
        if not data:
            break
        page = data.get("results", [])
        records.extend(page)
        if not data.get("next"):
            break
        offset += limit

    cache_write(cache_key, {"_cached_at": time.time(), "records": records})
    return records


@router.get("/players/{player_id}/seasons")
def player_seasons(player_id: int):
    """Returns the distinct season labels + match counts available for
    this player, so the frontend can populate the season dropdown before
    the user picks one. Also returns team_id per season so the UI can
    show "which club that season" next to the label, since a player can
    switch clubs mid-dataset (Salah: Liverpool -> Trabzonspor, same
    player_id, different team_id blocks of matches)."""
    cache_key = f"player_seasons__{player_id}"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < 3600:
        cached["cached"] = True
        return cached

    records = _walk_all_stats(player_id)
    if not records:
        raise HTTPException(status_code=404, detail=f"No stats found for player {player_id}.")

    # NOTE: stats records don't carry a date themselves either — only
    # event_id. Deriving season from event_id alone isn't possible
    # without a date, so this groups by event_id ordering as a rough
    # proxy (most recent records come first, matching the confirmed
    # Salah response ordering) until event dates can be joined in via
    # /events/{id}/. Flagging this as an approximation, not fact.
    by_team: dict[int, int] = {}
    for r in records:
        tid = r.get("team_id")
        by_team[tid] = by_team.get(tid, 0) + 1

    result = {
        "_cached_at":  time.time(),
        "player_id":   player_id,
        "total_matches_available": len(records),
        "team_blocks": [{"team_id": k, "match_count": v} for k, v in by_team.items()],
        "note": "Season labels need event dates joined in from /events/{id}/ to be exact — "
                "team_id blocks are a safe interim filter (pick a team_id, get that spell's matches). "
                "Confirm whether BSD's stats endpoint accepts a date_from/date_to or season param "
                "directly before building the full season-label walk — would save a lot of calls.",
        "cached": False,
    }
    cache_write(cache_key, result)
    return result

@router.get("/players/{player_id}/profile")
def player_profile(player_id: int):
    cache_key = f"player_profile__{player_id}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < SEARCH_TTL:
        cached["cached"] = True
        return cached

    data = bsd_get(f"/players/{player_id}/")
    if data is None:
        raise HTTPException(status_code=404, detail="Player not found in BSD API")

    result = {
        "_cached_at": time.time(),
        "id": data.get("id"),
        "name": data.get("name"),
        "short_name": data.get("short_name"),
        "position": data.get("position"),
        "jersey_number": data.get("jersey_number"),
        "date_of_birth": data.get("date_of_birth"),
        "height_cm": data.get("height_cm"),
        "weight_kg": data.get("weight_kg"),
        "preferred_foot": data.get("preferred_foot"),
        "nationality": data.get("nationality"),
        "current_team_id": data.get("current_team_id"),
        "current_team": data.get("current_team"),
        "market_value_eur": data.get("market_value_eur"),
        "contract_until": data.get("contract_until"),
        "rating": data.get("rating"),
        "cached": False,
    }
    cache_write(cache_key, result)
    return result
