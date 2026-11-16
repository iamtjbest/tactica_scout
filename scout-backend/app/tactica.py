"""
Scout -> main Tactica backend.

The ATK/DEF ratings and win probability shown on the Facts tab are NOT
computed here. They come from the main Tactica backend, which owns the
model:

    GET  /api/form?team={name}   -> attack, defence, win_percentage,
                                    best_formation
    POST /api/predict            -> probability, opp_probability,
                                    draw_probability, best_formation
"""
import os, time
import requests as _requests

from app.config import cache_read, cache_write, cache_age

TACTICA_API_URL = os.environ.get(
    "TACTICA_API_URL", "https://tactica-backend-hdbd.onrender.com"
).rstrip("/")

# Short 3-minute cache before kickoff so Scout mirrors app.tacticaengine.com live
RATINGS_TTL  = 180
DEGRADED_TTL = 45
TIMEOUT = 25


def _num(v):
    """Ratings come back as ints/floats, never trust a model's output type."""
    return v if isinstance(v, (int, float)) else None


def _norm(name: str | None) -> str:
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


def _resolved_to_other_club(form_payload: dict | None, asked_for: str) -> bool:
    if not isinstance(form_payload, dict):
        return False
    resolved = form_payload.get("bsd_name")
    if not resolved:
        return False
    return _norm(resolved) != _norm(asked_for)


def _form(team: str) -> dict | None:
    """GET /api/form -- the LIVE Dixon-Coles ratings off real fixtures."""
    try:
        resp = _requests.get(
            f"{TACTICA_API_URL}/api/form",
            params={"team": team},
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _predict(my_team: str, opp_team: str, overrides: dict | None = None) -> dict | None:
    """One POST /api/predict, matching app.tacticaengine.com."""
    body = {"my_team": my_team, "opp_team": opp_team}
    if overrides:
        body.update({k: v for k, v in overrides.items() if v is not None})
    try:
        resp = _requests.post(
            f"{TACTICA_API_URL}/api/predict",
            json=body,
            timeout=TIMEOUT,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def get_match_ratings(home_team: str | None, away_team: str | None, bypass_cache: bool = False) -> dict:
    """ATK/DEF for both sides plus canonical Home / Draw / Away win probabilities
    matching app.tacticaengine.com."""
    empty = {
        "home":                {"attack": None, "defence": None, "win_prob": None, "live_rating": False},
        "away":                {"attack": None, "defence": None, "win_prob": None, "live_rating": False},
        "draw_prob":           None,
        "best_formation":      None,
        "away_best_formation": None,
        "degraded":            True,
        "name_mismatch":       None,
    }

    if not home_team or not away_team:
        return empty

    cache_key = f"tactica_ratings_v7__{home_team.lower()}__{away_team.lower()}"
    if not bypass_cache:
        cached = cache_read(cache_key)
        if cached:
            ttl = DEGRADED_TTL if cached.get("degraded") else RATINGS_TTL
            if cache_age(cached) < ttl:
                return {k: v for k, v in cached.items() if k != "_cached_at"}

    # 1. Live ratings for each side from /api/form (single source of truth).
    hf = _form(home_team)
    af = _form(away_team)

    def _rt(f: dict | None) -> tuple[int | float | None, int | float | None]:
        if not isinstance(f, dict):
            return None, None
        return _num(f.get("attack")), _num(f.get("defence"))

    h_att, h_def = _rt(hf)
    a_att, a_def = _rt(af)

    mismatch = []
    if _resolved_to_other_club(hf, home_team):
        mismatch.append(f"home '{home_team}' resolved to '{(hf or {}).get('bsd_name')}'")
        h_att = h_def = None
        hf = None
    if _resolved_to_other_club(af, away_team):
        mismatch.append(f"away '{away_team}' resolved to '{(af or {}).get('bsd_name')}'")
        a_att = a_def = None
        af = None

    # 2. Canonical Home vs Away prediction matching app.tacticaengine.com
    h = _predict(home_team, away_team, {
        "is_home": True,
    })

    if h is None and hf is None and af is None:
        cache_write(cache_key, {"_cached_at": time.time(), **empty})
        return empty

    h = h or {}
    home_prob = _num(h.get("probability") or h.get("home_win_prob") or h.get("win_probability"))
    away_prob = _num(h.get("opp_probability") or h.get("away_win_prob") or h.get("loss_probability"))
    draw = _num(h.get("draw_probability") or h.get("draw_prob") or h.get("draw"))

    # Fetch away-side best_formation (and away win prob if /api/predict only returned 1-sided prob)
    a = _predict(away_team, home_team, {
        "is_home": False,
    }) or {}

    if away_prob is None:
        away_prob = _num(a.get("probability") or a.get("win_probability"))

    if home_prob is not None and away_prob is not None:
        if draw is None:
            raw_rem = 100.0 - home_prob - away_prob
            if raw_rem >= 0:
                draw = round(raw_rem, 1)
            else:
                total = home_prob + away_prob
                home_prob = round((home_prob / total) * 100.0, 1)
                away_prob = round(100.0 - home_prob, 1)
                draw = None
        else:
            total = home_prob + draw + away_prob
            if total > 0 and abs(total - 100.0) > 0.5:
                home_prob = round((home_prob / total) * 100.0, 1)
                draw = round((draw / total) * 100.0, 1)
                away_prob = round(max(0.0, 100.0 - home_prob - draw), 1)

    def _live(f: dict | None) -> bool:
        return bool(((f or {}).get("_debug") or {}).get("used_dynamic_rating"))

    result = {
        "home": {
            "attack":      h_att,
            "defence":     h_def,
            "win_prob":    home_prob,
            "live_rating": _live(hf),
        },
        "away": {
            "attack":      a_att,
            "defence":     a_def,
            "win_prob":    away_prob,
            "live_rating": _live(af),
        },
        "draw_prob":           draw,
        "best_formation":      h.get("best_formation"),
        "away_best_formation": a.get("best_formation"),
        "degraded":            False,
        "name_mismatch":       mismatch or None,
    }
    if result["home"]["attack"] is None and home_prob is None and away_prob is None:
        result["degraded"] = True

    cache_write(cache_key, {"_cached_at": time.time(), **result})
    return result


# ---------------------------------------------------------------------
# Frozen pre-match snapshots (locked at kickoff, live before kickoff)
# ---------------------------------------------------------------------

FORMULA_VERSION = "v3"
FREEZE_WINDOW_HOURS = float(os.environ.get("FREEZE_WINDOW_HOURS", "0"))


def get_frozen_ratings(event_id: int) -> dict | None:
    try:
        from app.supabase import get_supabase
        res = (
            get_supabase()
            .table("match_predictions")
            .select("payload, computed_at, formula_version")
            .eq("event_id", event_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
    except Exception as e:
        print(f"[tactica] frozen lookup failed for {event_id}: {e}")
        return None
    if not rows:
        return None
    row = rows[0]
    if row.get("formula_version") != FORMULA_VERSION:
        return None
    payload = dict(row.get("payload") or {})
    payload["frozen"] = True
    payload["provisional"] = False
    payload["computed_at"] = row.get("computed_at")
    payload["formula_version"] = row.get("formula_version")
    return payload


def is_freezable(result: dict) -> bool:
    if not isinstance(result, dict) or result.get("degraded") or result.get("name_mismatch"):
        return False
    for side in ("home", "away"):
        s = result.get(side) or {}
        if not s.get("live_rating"):
            return False
        if None in (s.get("attack"), s.get("defence"), s.get("win_prob")):
            return False
    return True


def freeze_ratings(event_id: int, home_team: str, away_team: str,
                   kickoff_iso: str, result: dict) -> dict | None:
    h, a = result["home"], result["away"]
    row = {
        "event_id":            event_id,
        "home_team":           home_team,
        "away_team":           away_team,
        "kickoff_at":          kickoff_iso,
        "home_attack":         h["attack"],
        "home_defence":        h["defence"],
        "away_attack":         a["attack"],
        "away_defence":        a["defence"],
        "home_win_prob":       h["win_prob"],
        "away_win_prob":       a["win_prob"],
        "draw_prob":           result.get("draw_prob"),
        "home_best_formation": result.get("best_formation"),
        "away_best_formation": result.get("away_best_formation"),
        "payload":             result,
        "formula_version":     FORMULA_VERSION,
    }
    try:
        from app.supabase import get_supabase
        get_supabase().table("match_predictions").upsert(row, on_conflict="event_id").execute()
    except Exception as e:
        print(f"[tactica] freeze upsert for {event_id} did not complete: {e}")
    return get_frozen_ratings(event_id)