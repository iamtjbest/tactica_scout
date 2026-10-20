"""
app/config.py — shared constants, BSD client, cache helpers.
Mirrors the pattern already proven out in iamtjbest/tactica-backend
(same BSD_BASE, same Token auth header, same file-cache approach) so
the two backends behave consistently and you're not learning a second
pattern. If tactica-backend's config.py changes (new league IDs, a
fixed bsd_find_team bug, etc.) port the fix here too.
"""
import os, json, time
import requests as _requests
from dotenv import load_dotenv

load_dotenv()

# ── API keys (set as Render/Railway environment variables) ───────────────────
BSD_KEY     = os.environ.get("BSD_API_KEY", "")
BSD_BASE    = "https://sports.bzzoiro.com/api/v2"
BSD_HEADERS = {"Authorization": f"Token {BSD_KEY}"}

# Raw BSD payload samples on API responses. These exist so unconfirmed
# field names (incident minute/player/side, league shapes) can be read
# off a live response. They are OFF by default: on a public endpoint
# they leak whole untrimmed upstream objects and bloat every payload.
# Set SCOUT_DEBUG=1 in the environment to turn them back on.
DEBUG_PAYLOADS = os.environ.get("SCOUT_DEBUG") == "1"


def debug_field(value):
    """Returns the sample when debugging is on, otherwise None so the
    key stays in the shape but carries nothing."""
    return value if DEBUG_PAYLOADS else None

# ── League ID → name — EMERGENCY FALLBACK ONLY ────────────────────────────
# Corrected 2026-10-08 against a real /leagues/ dump (90 leagues, no
# country filter needed, one call). The OLD numbers here were wrong —
# id 17 was labeled "Premier League" but is actually Saudi Pro League,
# id 11 was labeled "Serie A" but is actually Turkey's Süper Lig. That
# mislabeling is exactly what put Al-Fateh/Al-Qadsiah under "Premier
# League" and Trabzonspor/Göztepe under "Serie A" in matches-by-date.
# get_league_id_map() below is the real source of truth — this dict only
# fires if BSD is totally unreachable and even the live map build fails.
LEAGUE_NAMES = {
    1: "Premier League",         # England
    3: "La Liga",                # Spain
    5: "Bundesliga",             # Germany
    4: "Serie A",                # Italy
    6: "Ligue 1",                # France
    7: "Champions League",       # Europe
    8: "Europa League",          # Europe
    83: "Conference League",     # Europe
    10: "Eredivisie",            # Netherlands
    2: "Primeira Liga",          # Portugal (BSD's own name: "Liga Portugal Betclic")
    13: "Scottish Premiership",  # Scotland
    14: "Belgian Pro League",    # Belgium (BSD's own name: "Pro League")
    11: "Süper Lig",             # Turkey (BSD's own name: "Trendyol Super Lig")
    96: "Austrian Bundesliga",   # Austria
    17: "Saudi Pro League",      # Saudi Arabia — the id that caused this whole bug
}

# ── BSD HTTP helper ────────────────────────────────────────────────────────
def bsd_get(path: str, params: dict | None = None) -> dict | None:
    """GET from BSD API. Returns parsed JSON or None on error/non-200."""
    try:
        r = _requests.get(
            f"{BSD_BASE}{path}",
            headers=BSD_HEADERS,
            params=params,
            timeout=12,
        )
        if r.status_code == 200:
            return r.json()
        return None
    except Exception:
        return None

# ── League ID → name — LIVE, from BSD ─────────────────────────────────────
LEAGUE_MAP_TTL = 86400  # 1 day

def get_league_id_map() -> dict[int, str]:
    """Real BSD id -> name map, built from a single /leagues/ call with
    no country filter — confirmed 2026-10-08 this returns the full
    catalog in one page (90 leagues at limit=500, next: null, no
    pagination to chase). This is what matches.py should call instead
    of reading LEAGUE_NAMES directly. Note BSD's own name strings don't
    always match the common name (Süper Lig comes back as "Trendyol
    Super Lig", Belgian Pro League as "Pro League", Primeira Liga as
    "Liga Portugal Betclic") — that's fine for grouping but may need a
    display-name override later if we want prettier labels on the
    frontend."""
    cache_key = "bsd_league_id_map_v2"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < LEAGUE_MAP_TTL:
        return cached.get("map", {})
    data = bsd_get("/leagues/", params={"limit": 500})
    leagues = data if isinstance(data, list) else (data or {}).get("results", [])
    result = {
        lg["id"]: lg["name"]
        for lg in leagues
        if lg.get("id") is not None and not lg.get("is_women")
    }
    if result:
        cache_write(cache_key, {"map": result, "_cached_at": time.time()})
        return result
    return LEAGUE_NAMES  # BSD unreachable, old table as last resort

# -- League ID -> country, for picking a team's DOMESTIC league out of a
# fixture list that also contains continental competitions (Champions
# League, Europa League, etc). A continental competition's "country" on
# BSD is the confederation/region, not a national name, so matching the
# league's country against the team's own country field reliably
# separates "Premier League" from "Champions League" for an English
# club -- the earlier logic (first league_id seen in the next 5
# fixtures) had no way to tell those apart and would happily report
# Champions League as the team's primary league whenever that was the
# next match chronologically.
def get_league_country_map() -> dict[int, str]:
    """Real BSD id -> country map, built from the same /leagues/ call as
    get_league_id_map() (shares its cache under a sibling key so we are
    not doubling the BSD request rate)."""
    cache_key = "bsd_league_country_map_v1"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < LEAGUE_MAP_TTL:
        return cached.get("map", {})
    data = bsd_get("/leagues/", params={"limit": 500})
    leagues = data if isinstance(data, list) else (data or {}).get("results", [])
    result = {
        lg["id"]: lg.get("country", "")
        for lg in leagues
        if lg.get("id") is not None and not lg.get("is_women")
    }
    if result:
        cache_write(cache_key, {"map": result, "_cached_at": time.time()})
        return result
    return {}

# ── Season bucketing ──────────────────────────────────────────────────────
# BSD's /players/{id}/stats/ records do NOT carry a season field directly,
# only event_id, team_id and raw per-match numbers (confirmed on the real
# Salah response 2026-10-08). To let the frontend filter "which season",
# we derive a season label from each match's calendar date using the
# standard European season cutoff (1 Aug – 31 Jul). This is our own
# assumption, not something BSD states, flag it if matches look
# misbucketed once real data is tested.
def season_label_from_date(date_str: str) -> str:
    """'2026-09-14T15:00:00Z' -> '2026-27'. Falls back to 'unknown' on
    a bad/missing date."""
    try:
        year  = int(date_str[0:4])
        month = int(date_str[5:7])
        if month >= 8:
            return f"{year}-{str(year + 1)[-2:]}"
        return f"{year - 1}-{str(year)[-2:]}"
    except Exception:
        return "unknown"

# ── Cache helpers (file-based — swap for Redis later if volume resets) ───────
CACHE_DIR = os.environ.get("CACHE_DIR", "/tmp/pulse_cache")
os.makedirs(CACHE_DIR, exist_ok=True)

def cache_read(key: str) -> dict | None:
    path = os.path.join(CACHE_DIR, f"{key}.json")
    try:
        return json.load(open(path, encoding="utf-8"))
    except Exception:
        return None

def cache_write(key: str, data: dict):
    path = os.path.join(CACHE_DIR, f"{key}.json")
    try:
        json.dump(data, open(path, "w", encoding="utf-8"), indent=2)
    except Exception:
        pass

def cache_age(entry: dict) -> float:
    return time.time() - entry.get("_cached_at", 0)
# ── League-name resolution for a raw BSD event/match dict ─────────────────
# matches.py and live.py were each guessing a single field name
# (league_name / league_id) with no fallback, which is why almost
# everything was landing in a generic "Other" bucket and match_detail's
# competition line showed "Unknown" — same class of bug as the
# standings goals_for/points fix, just not caught until now. Shared
# here so both files resolve a league name the same way instead of
# drifting out of sync again.
def extract_league_name(ev: dict, league_map: dict) -> str:
    for key in ("league_name", "tournament_name", "competition_name"):
        val = ev.get(key)
        if val:
            return val
    for key in ("league", "tournament", "competition"):
        nested = ev.get(key)
        if isinstance(nested, dict):
            if nested.get("name"):
                return nested["name"]
            nid = nested.get("id")
            if nid is not None and (league_map.get(nid) or league_map.get(str(nid))):
                return league_map.get(nid) or league_map.get(str(nid))
    for key in ("league_id", "tournament_id", "competition_id"):
        lid = ev.get(key)
        if lid is not None and (league_map.get(lid) or league_map.get(str(lid))):
            return league_map.get(lid) or league_map.get(str(lid))
    return "Other"
