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


# ── Career / transfers / international ────────────────────────────────
# Three BSD resources the player page was never reading, which is why it
# showed a bio and a radar and nothing else. All three confirmed present
# in the BSD docs (Teams, players & transfers):
#   GET /players/{id}/career/         season-by-season summary
#   GET /players/{id}/transfers/      transfer history with fees
#   GET /players/{id}/national-team/  international record
#
# Cached for an hour: a career row changes when a season ends, a
# transfer when a window closes. A failed fetch is cached for 60s only,
# so an outage doesn't stick around for the full hour pretending the
# player has no career.
CAREER_TTL   = 3600
DEGRADED_TTL = 60


def _rows(payload) -> list:
    """BSD returns either a bare list or {"results": [...]}."""
    if isinstance(payload, dict) and "results" in payload:
        return payload.get("results") or []
    if isinstance(payload, list):
        return payload
    return []


def _cached_or_none(cache_key: str, ok_ttl: int):
    cached = cache_read(cache_key)
    if not cached:
        return None
    ttl = DEGRADED_TTL if cached.get("degraded") else ok_ttl
    if cache_age(cached) < ttl:
        cached["cached"] = True
        return cached
    return None


@router.get("/players/{player_id}/career")
def player_career(player_id: int):
    """Season-by-season summary: club, competition, appearances, goals."""
    cache_key = f"player_career__{player_id}"
    hit = _cached_or_none(cache_key, CAREER_TTL)
    if hit:
        return hit

    rows = _rows(bsd_get(f"/players/{player_id}/career/"))

    result = {
        "_cached_at": time.time(),
        "player_id":  player_id,
        "seasons":    rows,
        "degraded":   not rows,
        "cached":     False,
    }
    cache_write(cache_key, result)
    return result


@router.get("/players/{player_id}/transfers")
def player_transfers(player_id: int):
    """Transfer history, newest first.

    Fees are left exactly as BSD reports them. Per BSD's own docs a move
    with no published figure is "undisclosed", NOT a fee of zero -- their
    warning is that summing the blanks as zeroes reports a tenth of what
    the big leagues actually spend. So a missing fee stays null here and
    the frontend prints "Undisclosed", never a currency figure.
    """
    cache_key = f"player_transfers__{player_id}"
    hit = _cached_or_none(cache_key, CAREER_TTL)
    if hit:
        return hit

    # The player-scoped route is the documented one. /transfers/?player_id=
    # returns the same data but 400s on any unrecognised param, so prefer
    # the dedicated path and keep the feed as a fallback.
    rows = _rows(bsd_get(f"/players/{player_id}/transfers/"))
    if not rows:
        rows = _rows(bsd_get("/transfers/", params={"player_id": player_id, "limit": 100}))

    def _when(t: dict) -> str:
        return t.get("date") or t.get("transfer_date") or ""

    rows.sort(key=_when, reverse=True)

    result = {
        "_cached_at": time.time(),
        "player_id":  player_id,
        "transfers":  rows,
        "degraded":   not rows,
        "cached":     False,
    }
    cache_write(cache_key, result)
    return result


@router.get("/players/{player_id}/national-team")
def player_national_team(player_id: int):
    """International record: caps, goals, which national sides."""
    cache_key = f"player_national__{player_id}"
    hit = _cached_or_none(cache_key, CAREER_TTL)
    if hit:
        return hit

    data = bsd_get(f"/players/{player_id}/national-team/")
    rows = _rows(data)
    # Shape is unconfirmed -- the docs list the route but not its body.
    # Keep the list if there is one, otherwise hand the object through so
    # a single test run shows us which it is.
    summary = data if isinstance(data, dict) and "results" not in data else None

    result = {
        "_cached_at": time.time(),
        "player_id":  player_id,
        "teams":      rows,
        "summary":    summary,
        "degraded":   not rows and not summary,
        "cached":     False,
    }
    cache_write(cache_key, result)
    return result


# ── Season totals ─────────────────────────────────────────────────────
# NOTE on an unresolved conflict, deliberately not papered over:
#
# BSD's docs describe /players/{id}/stats/ as "per-match log -- season_id,
# team_id, league_id". The header comment at the top of this file says the
# opposite: that it carries no season field and no date, proven against a
# real Salah response on 2026-10-08.
#
# Rather than bet on one, this groups by whatever the records actually
# carry, in order of preference, and reports `grouped_by` plus
# `record_keys` so one real request settles it. If it comes back
# grouped_by="team_id" then the docs are wrong and the dropdown stays a
# club-spell filter; if it comes back "season_id" we can drop
# season_label_from_date entirely.
SEASON_STATS_TTL = 600

_SEASON_KEYS = ("season_id", "season", "season_name")
_DATE_KEYS   = ("event_date", "date", "kickoff", "start_time")

# Keys summed into totals. Anything absent from a record is skipped, not
# counted as zero -- same reasoning as the transfer fees above.
_SUM_KEYS = (
    "goals", "assists", "minutes_played", "yellow_cards", "red_cards",
    "shots", "shots_on_target", "passes", "key_passes", "tackles",
    "interceptions", "duels_won", "saves",
)


@router.get("/players/{player_id}/season-stats")
def player_season_stats(player_id: int, season: str | None = None):
    """Totals for one season plus a recent-match log.

    Pass ?season=<label> to pick one, or omit for the most recent group.
    """
    cache_key = f"player_season_stats__{player_id}__{season or 'latest'}"
    hit = _cached_or_none(cache_key, SEASON_STATS_TTL)
    if hit:
        return hit

    records = _walk_all_stats(player_id)

    def _group_of(r: dict):
        for k in _SEASON_KEYS:
            if r.get(k) not in (None, ""):
                return k, str(r[k])
        for k in _DATE_KEYS:
            if r.get(k):
                return k, season_label_from_date(r[k])
        if r.get("team_id") is not None:
            return "team_id", str(r["team_id"])
        return "none", "unknown"

    grouped_by = "none"
    labelled: list[tuple[str, dict]] = []
    for r in records:
        key, label = _group_of(r)
        if grouped_by == "none":
            grouped_by = key
        labelled.append((label, r))

    groups = sorted({lbl for lbl, _ in labelled if lbl != "unknown"}, reverse=True)
    target = season or (groups[0] if groups else None)
    rows = [r for lbl, r in labelled if lbl == target] if target else []

    totals = {"appearances": len(rows)}
    for key in _SUM_KEYS:
        present = [r[key] for r in rows if isinstance(r.get(key), (int, float))]
        # None, not 0, when the field simply isn't reported -- so the UI
        # can hide the row instead of claiming the player had 0 saves.
        totals[key] = int(sum(present)) if present else None

    def _when(r: dict) -> str:
        for k in _DATE_KEYS:
            if r.get(k):
                return str(r[k])
        return ""

    result = {
        "_cached_at": time.time(),
        "player_id":  player_id,
        "season":     target,
        "seasons_available": groups,
        "grouped_by": grouped_by,
        # Diagnostic: the keys a real record actually has. Settles the
        # season_id question on the first request. Drop once confirmed.
        "record_keys": sorted(records[0].keys()) if records else [],
        "totals": totals,
        "recent_matches": sorted(rows, key=_when, reverse=True)[:10],
        "degraded": not records,
        "cached":   False,
    }
    cache_write(cache_key, result)
    return result
