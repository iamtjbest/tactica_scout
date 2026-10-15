"""
GET /api/players/{id}/radar?team_id={optional}&limit={optional}

Aggregates a player's per-match BSD stats into the 6-axis radar shape:
Shooting, Passing, Dribbling, Defending, Creativity, Physical.

Four of the six axes use BSD's own pre-computed per-match normalized
scores (CONFIRMED present on the real Salah response, 2026-10-08):
  shot_value_normalized, pass_value_normalized,
  dribble_value_normalized, defensive_value_normalized
These are roughly -1 to 1 per match; this endpoint averages them across
the selected match window and rescales to 0-100 for the radar.

Creativity and Physical have no BSD pre-built field, so they're built
here from confirmed raw per-match fields:
  Creativity: key_pass, expected_assists, big_chance_created, goal_assist
  Physical:   duel_won/duel_lost, aerial_won/aerial_lost

IMPORTANT — season filtering isn't wired up yet. BSD's stats records
carry team_id but not a match date (confirmed on the real response),
so "select the season" on the frontend currently has to filter by
team_id (a club spell) rather than a true season label. True season
filtering needs event dates joined in from /events/{id}/ per match,
which is expensive at scale (one call per match) — worth testing
whether /players/{id}/stats/ accepts a date_from/date_to or season
query param directly before building that join, rather than assuming
it doesn't. This endpoint accepts team_id as the interim filter and
limit to cap how many recent matches of that spell get averaged.
"""
import time
from fastapi import APIRouter, HTTPException, Query
from app.routers.players import _walk_all_stats
from app.config import cache_read, cache_write, cache_age

router = APIRouter()
RADAR_TTL = 3600


def _avg(values: list[float]) -> float:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else 0.0


def _to_0_100(normalized_avg: float) -> float:
    """BSD's *_value_normalized fields run roughly -1 to 1 per match.
    Rescale the averaged value to a 0-100 radar axis. Clamp defensively
    since 'roughly' isn't a hard guarantee — re-check this range once
    more players' data has been pulled and compared."""
    scaled = (normalized_avg + 1) * 50
    return max(0.0, min(100.0, round(scaled, 1)))


@router.get("/players/{player_id}/radar")
def player_radar(
    player_id: int,
    team_id: int | None = Query(None, description="Filter to one club spell (interim stand-in for season filtering, see module docstring)"),
    limit:   int = Query(15, description="Most recent N matches of that spell to average"),
):
    cache_key = f"player_radar__{player_id}__{team_id}__{limit}"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < RADAR_TTL:
        cached["cached"] = True
        return cached

    records = _walk_all_stats(player_id)
    if not records:
        raise HTTPException(status_code=404, detail=f"No stats found for player {player_id}.")

    if team_id is not None:
        records = [r for r in records if r.get("team_id") == team_id]
        if not records:
            raise HTTPException(status_code=404, detail=f"No matches found for player {player_id} at team_id {team_id}.")

    # Records come back most-recent-first (confirmed ordering on the Salah
    # response) — take the first `limit` rather than the last.
    window = records[:limit]

    shooting   = _to_0_100(_avg([r.get("shot_value_normalized") for r in window]))
    passing    = _to_0_100(_avg([r.get("pass_value_normalized") for r in window]))
    dribbling  = _to_0_100(_avg([r.get("dribble_value_normalized") for r in window]))
    defending  = _to_0_100(_avg([r.get("defensive_value_normalized") for r in window]))

    # Creativity: no pre-built field, built from confirmed raw counts.
    # Rough per-90 style average, not yet weighted/validated against a
    # known high-creativity player — treat this axis as a first draft.
    avg_key_pass   = _avg([r.get("key_pass") for r in window])
    avg_xa         = _avg([r.get("expected_assists") for r in window])
    avg_big_chance = _avg([r.get("big_chance_created") for r in window])
    avg_assists    = _avg([r.get("goal_assist") for r in window])
    creativity_raw = (avg_key_pass * 1.0) + (avg_xa * 10) + (avg_big_chance * 2) + (avg_assists * 3)
    creativity = max(0.0, min(100.0, round(creativity_raw * 8, 1)))  # scale factor is a first guess, tune against real players

    # Physical: duels + aerials won as a share of contested, confirmed fields.
    total_won  = sum((r.get("duel_won") or 0) + (r.get("aerial_won") or 0) for r in window)
    total_lost = sum((r.get("duel_lost") or 0) + (r.get("aerial_lost") or 0) for r in window)
    total_duels = total_won + total_lost
    physical = round((total_won / total_duels) * 100, 1) if total_duels else 0.0

    result = {
        "_cached_at":   time.time(),
        "player_id":    player_id,
        "team_id_filter": team_id,
        "matches_used": len(window),
        "radar": {
            "shooting":   shooting,
            "passing":    passing,
            "dribbling":  dribbling,
            "defending":  defending,
            "creativity": creativity,
            "physical":   physical,
        },
        "note": "Creativity and Physical axes are first-draft scaling, not validated against known "
                "high/low players yet — sanity check these once you have two contrasting players "
                "(e.g. a creative midfielder vs a destroyer) pulled side by side.",
        "cached": False,
    }
    cache_write(cache_key, result)
    return result
