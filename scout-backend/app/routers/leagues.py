"""
app/routers/leagues.py

League / Competition Hub endpoints:
  GET /api/leagues
  GET /api/leagues/{league_id}/seasons
  GET /api/standings?league_id=1&season_id=...
  GET /api/leagues/{league_id}/fixtures?season_id=...
  GET /api/leagues/{league_id}/top-stats?season_id=...
  GET /api/leagues/{league_id}/team-stats?season_id=...
"""
import time
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.config import (
    bsd_get,
    cache_read,
    cache_write,
    cache_age,
    get_league_id_map,
    LEAGUE_NAMES,
    debug_field,
)

router = APIRouter()
STANDINGS_TTL = 300
SEASONS_TTL = 3600


def _resolve_league_meta(league_id: int, raw_payload: dict | None = None) -> dict:
    """Never return 'Unknown' if BSD has the league name anywhere."""
    league_map = get_league_id_map()
    name = league_map.get(league_id) or league_map.get(str(league_id)) or LEAGUE_NAMES.get(league_id)
    country = ""

    if isinstance(raw_payload, dict):
        if not name:
            name = raw_payload.get("league_name") or (
                raw_payload.get("league", {}).get("name")
                if isinstance(raw_payload.get("league"), dict)
                else None
            )
        country = raw_payload.get("country") or ""

    meta = bsd_get(f"/leagues/{league_id}/")
    if isinstance(meta, dict):
        name = name or meta.get("name")
        country = country or meta.get("country") or ""

    return {
        "league_id": league_id,
        "name": name or f"Competition #{league_id}",
        "country": country,
        "raw_meta": meta if isinstance(meta, dict) else {},
    }


@router.get("/leagues")
def list_leagues():
    league_map = get_league_id_map()
    # Include curated leagues plus NPFL / African & global leagues present in BSD map
    seen = set()
    out = []
    for lid, fallback_name in LEAGUE_NAMES.items():
        seen.add(lid)
        out.append({"league_id": lid, "name": league_map.get(lid, fallback_name)})
    for lid, nm in sorted(league_map.items(), key=lambda x: str(x[1])):
        try:
            int_id = int(lid)
        except (TypeError, ValueError):
            continue
        if int_id not in seen and nm:
            seen.add(int_id)
            out.append({"league_id": int_id, "name": nm})
    return {"leagues": out}


@router.get("/leagues/{league_id}/seasons")
def league_seasons(league_id: int):
    """Returns clickable seasons (e.g. 2026/2027, 2025/2026) + previous winners."""
    cache_key = f"league_seasons__v2__{league_id}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < SEASONS_TTL:
        cached["cached"] = True
        return cached

    meta_info = _resolve_league_meta(league_id)
    raw_seasons = bsd_get(f"/leagues/{league_id}/seasons/")
    items = []
    if isinstance(raw_seasons, list):
        items = raw_seasons
    elif isinstance(raw_seasons, dict):
        items = raw_seasons.get("results") or raw_seasons.get("seasons") or []

    if not items and isinstance(meta_info["raw_meta"].get("seasons"), list):
        items = meta_info["raw_meta"]["seasons"]

    seasons = []
    for idx, s in enumerate(items):
        if not isinstance(s, dict):
            continue
        sid = s.get("id") or s.get("season_id")
        label = str(s.get("name") or s.get("year") or "").strip()
        if not label and s.get("start_date"):
            y0 = int(str(s["start_date"])[:4])
            label = f"{y0}/{y0 + 1}"
        if not label:
            continue

        winner = s.get("winner") or s.get("champion")
        winner_name = None
        winner_id = None
        if isinstance(winner, dict):
            winner_name = winner.get("name") or winner.get("team_name")
            winner_id = winner.get("id") or winner.get("team_id")
        elif isinstance(winner, str):
            winner_name = winner

        # For past seasons without an explicit winner field, look up rank #1 from standings
        is_current = bool(s.get("is_current")) or idx == 0
        if not winner_name and not is_current and sid is not None:
            st_data = bsd_get(f"/leagues/{league_id}/standings/", params={"season_id": sid})
            rows = (
                st_data
                if isinstance(st_data, list)
                else (st_data or {}).get("results") or (st_data or {}).get("standings") or []
            )
            if rows and isinstance(rows[0], dict):
                top = rows[0]
                winner_name = top.get("team_name") or (
                    top.get("team", {}).get("name") if isinstance(top.get("team"), dict) else None
                )
                winner_id = top.get("team_id") or (
                    top.get("team", {}).get("id") if isinstance(top.get("team"), dict) else None
                )

        seasons.append({
            "id": sid,
            "label": label,
            "is_current": is_current,
            "winner_name": winner_name,
            "winner_id": winner_id,
        })

    # Fallback if BSD didn't expose historical season objects for this competition
    if not seasons:
        now = datetime.utcnow()
        y = now.year if now.month >= 7 else now.year - 1
        seasons = [
            {"id": None, "label": f"{y}/{y + 1}", "is_current": True, "winner_name": None, "winner_id": None},
            {"id": None, "label": f"{y - 1}/{y}", "is_current": False, "winner_name": None, "winner_id": None},
        ]

    result = {
        "_cached_at": time.time(),
        "league_id": league_id,
        "league": meta_info["name"],
        "country": meta_info["country"],
        "seasons": seasons,
        "cached": False,
    }
    cache_write(cache_key, result)
    return result


def _fetch_standings_raw(league_id: int, season_id: int | None = None):
    params = {"season_id": season_id} if season_id is not None else None
    data = bsd_get(f"/leagues/{league_id}/standings/", params=params)
    if data is not None:
        return data
    flat_params = {"league_id": league_id}
    if season_id is not None:
        flat_params["season_id"] = season_id
    return bsd_get("/standings/", params=flat_params)


def _first_present(r: dict, *keys):
    for k in keys:
        if k in r and r[k] is not None:
            return r[k]
    return None


def _row(r: dict) -> dict:
    team = r.get("team_name")
    team_id = r.get("team_id")
    if isinstance(r.get("team"), dict):
        team = team or r["team"].get("name")
        team_id = team_id or r["team"].get("id")

    goals_for = _first_present(r, "goals_for", "goals_scored", "scored", "gf", "for") or 0
    goals_against = _first_present(r, "goals_against", "goals_conceded", "conceded", "ga", "against") or 0
    points = _first_present(r, "points", "pts", "point") or 0
    goal_diff = _first_present(r, "goal_difference", "goals_diff", "goal_diff", "gd")
    if goal_diff is None:
        goal_diff = goals_for - goals_against

    raw_form = r.get("form")
    if isinstance(raw_form, str):
        form = [c for c in raw_form.upper() if c in ("W", "D", "L")][-5:]
    elif isinstance(raw_form, list):
        form = [str(c).upper() for c in raw_form if str(c).upper() in ("W", "D", "L")][-5:]
    else:
        form = []

    return {
        "position": r.get("position") or r.get("rank"),
        "team": team or "",
        "team_id": team_id,
        "played": r.get("played") or r.get("matches_played") or 0,
        "won": r.get("won") or r.get("wins") or 0,
        "drawn": r.get("drawn") or r.get("draws") or 0,
        "lost": r.get("lost") or r.get("losses") or 0,
        "goals_for": goals_for,
        "goals_against": goals_against,
        "goal_diff": goal_diff,
        "points": points,
        "form": form,
        "zone": r.get("zone"),
    }


@router.get("/standings")
def standings(league_id: int, season_id: int | None = None):
    cache_key = f"standings__v3__{league_id}__{season_id or 'current'}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < STANDINGS_TTL:
        cached["cached"] = True
        return cached

    data = _fetch_standings_raw(league_id, season_id=season_id)
    if data is None:
        if cached:
            cached["cached"] = True
            cached["stale"] = True
            return cached
        raise HTTPException(status_code=502, detail="Could not load standings from BSD.")

    meta = _resolve_league_meta(league_id, data if isinstance(data, dict) else None)
    league_name = meta["name"]

    groups_raw = data.get("groups") if isinstance(data, dict) else None
    if isinstance(groups_raw, dict) and groups_raw:
        groups = [
            {"group": group_name, "standings": [_row(r) for r in (rows or [])]}
            for group_name, rows in groups_raw.items()
        ]
        result = {
            "_cached_at": time.time(),
            "league_id": league_id,
            "league": league_name,
            "country": meta["country"],
            "season_id": season_id,
            "standings": None,
            "groups": groups,
            "cached": False,
        }
        cache_write(cache_key, result)
        return result

    rows_raw = data if isinstance(data, list) else (data.get("results") or data.get("standings") or [])
    result = {
        "_cached_at": time.time(),
        "league_id": league_id,
        "league": league_name,
        "country": meta["country"],
        "season_id": season_id,
        "standings": [_row(r) for r in rows_raw],
        "groups": None,
        "cached": False,
    }
    cache_write(cache_key, result)
    return result


@router.get("/leagues/{league_id}/fixtures")
def league_fixtures(league_id: int, season_id: int | None = None):
    cache_key = f"league_fixtures__v2__{league_id}__{season_id or 'current'}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < STANDINGS_TTL:
        cached["cached"] = True
        return cached

    params: dict = {"league_id": league_id, "limit": 250}
    if season_id is not None:
        params["season_id"] = season_id
    data = bsd_get("/events/", params=params)

    events = []
    if isinstance(data, dict) and "results" in data:
        events = data.get("results", [])
    elif isinstance(data, list):
        events = data

    matches = []
    for ev in events:
        matches.append({
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
            "round": ev.get("round_label") or ev.get("round_name") or ev.get("round_number"),
        })

    result = {
        "_cached_at": time.time(),
        "league_id": league_id,
        "season_id": season_id,
        "matches": matches,
        "cached": False,
    }
    cache_write(cache_key, result)
    return result


def _norm_leader(row: dict, idx: int) -> dict:
    player = row.get("player") if isinstance(row.get("player"), dict) else {}
    team = row.get("team") if isinstance(row.get("team"), dict) else {}
    pid = row.get("player_id") or player.get("id")
    pname = row.get("player_name") or player.get("name") or "Unknown"
    tid = row.get("team_id") or team.get("id")
    tname = row.get("team_name") or team.get("name") or ""
    val = _first_present(row, "value", "goals", "assists", "rating", "cards", "yellow_cards", "clean_sheets") or 0
    return {
        "rank": row.get("rank") or (idx + 1),
        "player_id": pid,
        "player_name": pname,
        "team_id": tid,
        "team_name": tname,
        "value": val,
    }


def _extract_leaders(payload) -> list[dict]:
    if not payload:
        return []
    raw = payload if isinstance(payload, list) else (payload.get("leaders") or payload.get("results") or [])
    return [_norm_leader(r, i) for i, r in enumerate(raw) if isinstance(r, dict)]


@router.get("/leagues/{league_id}/top-stats")
def league_top_stats(league_id: int, season_id: int | None = None):
    cache_key = f"league_top_stats__v2__{league_id}__{season_id or 'current'}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < STANDINGS_TTL:
        cached["cached"] = True
        return cached

    params = {"season_id": season_id} if season_id is not None else None
    scorers_data = bsd_get(f"/leagues/{league_id}/top/scorers/", params=params)
    assists_data = bsd_get(f"/leagues/{league_id}/top/assists/", params=params)
    ratings_data = bsd_get(f"/leagues/{league_id}/top/ratings/", params=params)
    cards_data = bsd_get(f"/leagues/{league_id}/top/cards/", params=params)

    result = {
        "_cached_at": time.time(),
        "league_id": league_id,
        "season_id": season_id,
        "scorers": _extract_leaders(scorers_data),
        "assists": _extract_leaders(assists_data),
        "ratings": _extract_leaders(ratings_data),
        "cards": _extract_leaders(cards_data),
        "cached": False,
    }
    cache_write(cache_key, result)
    return result


@router.get("/leagues/{league_id}/team-stats")
def league_team_stats(league_id: int, season_id: int | None = None):
    """Per-team competition metrics: Goals/Match, Conceded/Match, Clean Sheets, Win Rate, Possession."""
    cache_key = f"league_team_stats__v1__{league_id}__{season_id or 'current'}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < STANDINGS_TTL:
        cached["cached"] = True
        return cached

    std = standings(league_id, season_id=season_id)
    rows: list[dict] = []
    if std.get("standings"):
        rows = std["standings"]
    elif std.get("groups"):
        for g in std["groups"]:
            rows.extend(g.get("standings") or [])

    fix = league_fixtures(league_id, season_id=season_id)
    matches = fix.get("matches") or []

    clean_sheets: dict[int, int] = {}
    finished_ids: list[int] = []
    for m in matches:
        st = str(m.get("status") or "").lower()
        if st not in ("finished", "ended", "played", "ft"):
            continue
        if m.get("event_id"):
            finished_ids.append(int(m["event_id"]))
        hs, as_ = m.get("home_score"), m.get("away_score")
        hid, aid = m.get("home_team_id"), m.get("away_team_id")
        if hs is not None and as_ is not None:
            if hid and int(as_) == 0:
                clean_sheets[hid] = clean_sheets.get(hid, 0) + 1
            if aid and int(hs) == 0:
                clean_sheets[aid] = clean_sheets.get(aid, 0) + 1

    # Sample up to 16 recent finished matches for average possession % when available
    poss_samples: dict[int, list[float]] = {}
    for eid in finished_ids[-16:]:
        m_info = next((x for x in matches if x.get("event_id") == eid), None)
        if not m_info:
            continue
        st_payload = bsd_get(f"/events/{eid}/stats/")
        if not isinstance(st_payload, list):
            continue
        for item in st_payload:
            label = str(item.get("name") or item.get("type") or "").lower()
            if "possession" in label:
                try:
                    hp = float(str(item.get("home", "")).replace("%", "").strip())
                    ap = float(str(item.get("away", "")).replace("%", "").strip())
                    if m_info.get("home_team_id"):
                        poss_samples.setdefault(m_info["home_team_id"], []).append(hp)
                    if m_info.get("away_team_id"):
                        poss_samples.setdefault(m_info["away_team_id"], []).append(ap)
                except ValueError:
                    pass

    teams_out = []
    for r in rows:
        tid = r.get("team_id")
        mp = max(1, int(r.get("played") or 0))
        played_raw = int(r.get("played") or 0)
        gf = int(r.get("goals_for") or 0)
        ga = int(r.get("goals_against") or 0)
        won = int(r.get("won") or 0)
        p_list = poss_samples.get(tid) or []
        teams_out.append({
            "team_id": tid,
            "team": r.get("team"),
            "played": played_raw,
            "goals_per_match": round(gf / mp, 2) if played_raw else 0.0,
            "conceded_per_match": round(ga / mp, 2) if played_raw else 0.0,
            "clean_sheets": clean_sheets.get(tid, 0),
            "win_rate": round((won / mp) * 100, 1) if played_raw else 0.0,
            "possession_avg": round(sum(p_list) / len(p_list), 1) if p_list else None,
        })

    result = {
        "_cached_at": time.time(),
        "league_id": league_id,
        "season_id": season_id,
        "goals_per_match": sorted(teams_out, key=lambda x: -x["goals_per_match"]),
        "conceded_per_match": sorted(teams_out, key=lambda x: x["conceded_per_match"]),
        "clean_sheets": sorted(teams_out, key=lambda x: -x["clean_sheets"]),
        "win_rate": sorted(teams_out, key=lambda x: -x["win_rate"]),
        "possession": sorted(
            [t for t in teams_out if t["possession_avg"] is not None],
            key=lambda x: -(x["possession_avg"] or 0),
        ),
        "cached": False,
    }
    cache_write(cache_key, result)
    return result