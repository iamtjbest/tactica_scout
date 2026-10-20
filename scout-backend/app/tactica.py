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


def _norm(name: str | None) -> str:
    return "".join(ch for ch in (name or "").lower() if ch.isalnum())


def _resolved_to_other_club(form_payload: dict | None, asked_for: str) -> bool:
    """Did /api/form answer about a different club than we asked about?

    Tactica takes a team NAME and resolves it through its own BSD search.
    It already strips youth and women's sides before resolving, so the
    risk is not a U21 team: it's a name landing on a genuinely different
    club.

    What it does NOT treat as a mismatch is BSD holding two senior
    records for the same club under the same name ("Manchester United"
    is both 17 and 8624). Those are duplicates, and refusing the rating
    over which one got picked would throw away a correct number. So this
    compares the resolved NAME, not the id.
    """
    if not isinstance(form_payload, dict):
        return False
    resolved = form_payload.get("bsd_name")
    if not resolved:
        return False
    return _norm(resolved) != _norm(asked_for)


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
        "name_mismatch":   None,
    }

    if not home_team or not away_team:
        return empty

    cache_key = f"tactica_ratings_v5__{home_team.lower()}__{away_team.lower()}"
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

    # Drop a rating that belongs to a different club. Tactica already
    # strips youth and women's sides before resolving, so this is only
    # about a name landing on a genuinely different senior club.
    mismatch = []
    if _resolved_to_other_club(hf, home_team):
        mismatch.append(
            f"home '{home_team}' resolved to '{(hf or {}).get('bsd_name')}'"
        )
        h_att = h_def = None
        hf = None
    if _resolved_to_other_club(af, away_team):
        mismatch.append(
            f"away '{away_team}' resolved to '{(af or {}).get('bsd_name')}'"
        )
        a_att = a_def = None
        af = None

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
        # Non-empty when a name resolved to the wrong club. Surfaced so a
        # silent mismatch shows up instead of becoming a wrong number.
        "name_mismatch":       mismatch or None,
    }
    if result["home"]["attack"] is None and home_prob is None and away_prob is None:
        result["degraded"] = True

    cache_write(cache_key, {"_cached_at": time.time(), **result})
    return result


# ---------------------------------------------------------------------
# Frozen pre-match snapshots
#
# get_match_ratings() above always reflects form RIGHT NOW. That is wrong
# for a match page: MUN vs TOT was rated 56/58 vs 40/42 on the day, and
# once both teams play again the live numbers move. The row stored here
# is written once, shortly before kickoff, and is what every later view
# of that match shows. Next match, new row, newly calculated numbers.
#
# The table is created by match_predictions.sql, and a database trigger
# rejects any UPDATE, so a frozen row cannot be changed even by a bug.
# ---------------------------------------------------------------------

# Bump when the rating formula or the model changes. Old rows keep the
# version that produced them.
FORMULA_VERSION = "v1"

# Freeze only this close to kickoff. Further out, a team may still play
# another match and the numbers would be stale by kickoff, so earlier
# views get live numbers marked provisional instead of a frozen row.
FREEZE_WINDOW_HOURS = float(os.environ.get("FREEZE_WINDOW_HOURS", "6"))


def get_frozen_ratings(event_id: int) -> dict | None:
    """The stored snapshot for this match, or None if there isn't one
    (or Supabase can't be reached, in which case the caller falls back
    to computing live rather than failing the Facts tab)."""
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
    payload = dict(row.get("payload") or {})
    payload["frozen"] = True
    payload["provisional"] = False
    payload["computed_at"] = row.get("computed_at")
    payload["formula_version"] = row.get("formula_version")
    return payload


def is_freezable(result: dict) -> bool:
    """Only a complete, trustworthy result gets frozen for good.

    A degraded result (Tactica asleep, a name that resolved to the wrong
    club, a baseline rating that isn't live) must never be locked in,
    because it would then show forever. Those are returned unfrozen and
    retried on the next view while the match is still in the window.
    """
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
    """Insert the snapshot. Returns the stored payload, or None if it
    couldn't be saved. If two requests race, the unique key lets exactly
    one insert win and the other simply reads the winner's row, so both
    callers end up showing the same numbers."""
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
        get_supabase().table("match_predictions").insert(row).execute()
    except Exception as e:
        # Most likely the row already exists (a racing request got there
        # first). Read it back so both callers agree on one number.
        print(f"[tactica] freeze insert for {event_id} did not complete: {e}")
    return get_frozen_ratings(event_id)
