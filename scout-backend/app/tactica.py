"""
Scout -> main Tactica backend.

The ATK/DEF ratings and win probability shown on the Facts tab are NOT
computed here. They come from the main Tactica backend, which owns the
model:

    GET  /api/form?team={name}   -> attack, defence, win_percentage,
                                    best_formation  (Dixon-Coles style
                                    dynamic ratings off real matches)
    POST /api/predict            -> probability, my_attack, my_defence,
                                    opp_attack, opp_defence, H2H blending

Deliberately one source of truth. If Scout computed its own ratings we
would have two Tacticas that disagree, and the app would contradict the
numbers published in @TacticaEngine's posts. A missing rating here is
always better than a different one.

/api/predict is the call we want for a match view: one request returns
both sides' ratings AND a win probability, already H2H-blended.
"""
import os, time
import requests as _requests

from app.config import cache_read, cache_write, cache_age

TACTICA_API_URL = os.environ.get(
    "TACTICA_API_URL", "https://tactica-backend-hdbd.onrender.com"
).rstrip("/")

# Ratings move when a team plays, not minute to minute. But a failed call
# must not be cached for an hour, same degraded pattern as everywhere else.
RATINGS_TTL  = 1800
DEGRADED_TTL = 60

# Render's free tier spins down when idle and takes roughly a minute to
# wake. A short timeout here would turn every cold start into a permanent
# "no ratings" on the Facts tab, so this is generous on purpose -- the
# call is already off the critical path (match detail renders without it).
TIMEOUT = 25


def _num(v):
    """Ratings come back as ints, but never trust a model's output type."""
    return v if isinstance(v, (int, float)) else None


def _form(team: str) -> dict | None:
    """GET /api/form -- the LIVE Dixon-Coles ratings off real fixtures.

    This is the call that matters. /api/predict on its own resolves
    ratings from teams.json, then a hardcoded _KNOWN_RATINGS table, then
    a flat 72. It never runs the dynamic calculation, which is why a raw
    predict call returns numbers that haven't moved in weeks.
    """
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
    """One POST /api/predict, with live ratings passed in as overrides.

    PredictRequest's my_att/my_def/opp_att/opp_def exist for exactly
    this ("Optional overrides -- dynamic ratings from last-5 fetch").
    Without them the model scores formations against stale baselines.
    """
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


def get_match_ratings(home_team: str | None, away_team: str | None) -> dict:
    """ATK/DEF for both sides plus a win probability for EACH team.

    /api/predict is asymmetric: it answers "what are my_team's chances
    against opp_team", picking my_team's best formation. So we call it
    twice, once from each side, which is how Tactica reports a fixture --
    a number for the home side and a number for the away side.

    The two calls are independent model runs, so they will not always sum
    to 100 with a clean draw left over. `draw` is therefore only filled
    in when the two actually leave room for it, and is None otherwise
    rather than being forced to make the row add up.
    """
    empty = {
        "home":            {"attack": None, "defence": None, "win_prob": None, "live_rating": False},
        "away":            {"attack": None, "defence": None, "win_prob": None, "live_rating": False},
        "draw_prob":       None,
        "best_formation":  None,
        "away_best_formation": None,
        "degraded":        True,
    }

    if not home_team or not away_team:
        return empty

    cache_key = f"tactica_ratings_v3__{home_team.lower()}__{away_team.lower()}"
    cached = cache_read(cache_key)
    if cached:
        ttl = DEGRADED_TTL if cached.get("degraded") else RATINGS_TTL
        if cache_age(cached) < ttl:
            return {k: v for k, v in cached.items() if k != "_cached_at"}

    # 1. Live ratings for each side. These are the real numbers --
    #    same ones app.tactica.com.ng shows, because it's the same call.
    hf = _form(home_team)
    af = _form(away_team)

    def _rt(f: dict | None) -> tuple[int | None, int | None]:
        if not isinstance(f, dict):
            return None, None
        return _num(f.get("attack")), _num(f.get("defence"))

    h_att, h_def = _rt(hf)
    a_att, a_def = _rt(af)

    # 2. Feed them into the model as overrides, once from each side.
    h = _predict(home_team, away_team, {
        "my_att": h_att, "my_def": h_def,
        "opp_att": a_att, "opp_def": a_def,
    })
    a = _predict(away_team, home_team, {
        "my_att": a_att, "my_def": a_def,
        "opp_att": h_att, "opp_def": h_def,
    })

    if h is None and a is None and hf is None and af is None:
        cache_write(cache_key, {"_cached_at": time.time(), **empty})
        return empty

    h = h or {}
    a = a or {}

    home_prob = _num(h.get("probability"))
    away_prob = _num(a.get("probability"))

    draw = None
    if home_prob is not None and away_prob is not None:
        remainder = 100.0 - home_prob - away_prob
        if remainder > 0:
            draw = round(remainder, 1)

    # /api/form tells us whether it actually used the dynamic calculation
    # or fell back to a baseline. Worth carrying through: a baseline
    # number is not wrong, but it isn't live either.
    def _live(f: dict | None) -> bool:
        return bool(((f or {}).get("_debug") or {}).get("used_dynamic_rating"))

    result = {
        # ONLY /api/form's numbers. Deliberately NOT falling back to
        # what /predict echoes back: with teams.json absent and the
        # _KNOWN_RATINGS tables going away, predict's own my_attack is
        # either a stale baseline or a flat 72 for everyone. Echoing
        # that would put a made-up rating under Tactica's name, which is
        # the exact failure we removed from the mobile app today.
        # No live rating means no rating, and the UI shows "--".
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
    }
    if result["home"]["attack"] is None and home_prob is None and away_prob is None:
        result["degraded"] = True

    cache_write(cache_key, {"_cached_at": time.time(), **result})
    return result
