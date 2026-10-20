"""
app/routers/tournaments_public.py

The Scout-facing side of a tournament: what fans see. No auth, because
this is the same audience that browses live scores.

ONLY approved tournaments are served here. Every query filters on
status = 'approved', which is the publish gate the whole review
workflow exists to enforce. A draft or a rejected tournament is
invisible to this router, and that filter is repeated in each endpoint
rather than left to a helper somebody might forget to call.

Standings are computed from fixtures on read, not stored. A points
table that lives in a column drifts the moment a score is corrected,
and correcting scores is the single most common thing an organiser
does.
"""
import time

from fastapi import APIRouter, HTTPException

from app.config import cache_read, cache_write, cache_age
from app.routers.editor import _db, _rows, _one

router = APIRouter()

# Short: an organiser is often updating a score while people are
# watching, and a stale table during a live match is worse than a
# slightly chattier query.
TOURNAMENT_TTL = 30

FINISHED = {"ft"}

DEFAULT_TIEBREAKERS = ["goal_difference", "goals_scored", "head_to_head"]


@router.get("/tournaments")
def list_public_tournaments(country: str | None = None, level: str | None = None):
    """Approved tournaments, for Scout's tournament browser."""
    q = (
        _db().table("tournaments")
        .select("id, name, level, gender, country, start_date, end_date, "
                "format, organizing_body")
        .eq("status", "approved")
        .order("start_date", desc=True)
    )
    if country:
        q = q.eq("country", country)
    if level:
        q = q.eq("level", level)
    rows = _rows(q.execute())
    return {"count": len(rows), "tournaments": rows}


def _team_lookup(tournament_id: str) -> dict[str, dict]:
    rows = _rows(
        _db().table("tournament_teams")
        .select("id, group_name, clubs(id, name, short_name, crest_url)")
        .eq("tournament_id", tournament_id).execute()
    )
    out = {}
    for r in rows:
        club = r.get("clubs") or {}
        out[r["id"]] = {
            "team_id":    r["id"],
            "club_id":    club.get("id"),
            "name":       club.get("name") or "Unknown",
            "short_name": club.get("short_name"),
            "crest_url":  club.get("crest_url"),
            "group_name": r.get("group_name"),
        }
    return out


def _blank_row(team: dict) -> dict:
    return {
        **team,
        "played": 0, "won": 0, "drawn": 0, "lost": 0,
        "goals_for": 0, "goals_against": 0, "goal_difference": 0,
        "points": 0, "form": [],
    }


def _standings(tournament_id: str, teams: dict[str, dict],
               fixtures: list[dict], tiebreakers: list[str]) -> list[dict]:
    """League table from finished fixtures only.

    Three points for a win. A match that is live, postponed or has a
    missing score contributes nothing: half a result is not a result,
    and counting a live 1-0 as final makes the table jump around while
    people are looking at it.
    """
    table = {tid: _blank_row(t) for tid, t in teams.items()}

    ordered = sorted(fixtures, key=lambda f: f.get("kickoff_at") or "")
    for fx in ordered:
        if str(fx.get("status") or "").lower() not in FINISHED:
            continue
        h, a = fx.get("home_team_id"), fx.get("away_team_id")
        hs, as_ = fx.get("home_score"), fx.get("away_score")
        if h not in table or a not in table or hs is None or as_ is None:
            continue

        for tid, gf, ga in ((h, hs, as_), (a, as_, hs)):
            row = table[tid]
            row["played"] += 1
            row["goals_for"] += gf
            row["goals_against"] += ga
            if gf > ga:
                row["won"] += 1; row["points"] += 3; row["form"].append("W")
            elif gf == ga:
                row["drawn"] += 1; row["points"] += 1; row["form"].append("D")
            else:
                row["lost"] += 1; row["form"].append("L")

    for row in table.values():
        row["goal_difference"] = row["goals_for"] - row["goals_against"]
        row["form"] = row["form"][-5:]

    rows = list(table.values())

    # head_to_head is listed in the schema's default tiebreakers but is
    # NOT implemented here. Doing it properly means building a mini
    # table among only the tied teams, and a half-version that compares
    # two teams pairwise gives the wrong answer for three-way ties. It
    # is skipped rather than approximated, and reported in `applied`
    # below so nobody assumes it ran.
    supported = {
        "goal_difference": lambda r: -r["goal_difference"],
        "goals_scored":    lambda r: -r["goals_for"],
        "goals_for":       lambda r: -r["goals_for"],
        "wins":            lambda r: -r["won"],
    }
    applied = [t for t in (tiebreakers or DEFAULT_TIEBREAKERS) if t in supported]

    def sort_key(r: dict):
        return tuple([-r["points"]] + [supported[t](r) for t in applied] + [r["name"].lower()])

    rows.sort(key=sort_key)
    for i, r in enumerate(rows, start=1):
        r["position"] = i
    return rows


@router.get("/tournaments/{tournament_id}")
def public_tournament(tournament_id: str):
    """Everything Scout needs for a tournament page: the table, the
    fixtures with real team names, and the groups if it has them."""
    cache_key = f"public_tournament__{tournament_id}"
    cached = cache_read(cache_key)
    if cached and cache_age(cached) < TOURNAMENT_TTL:
        cached["cached"] = True
        return cached

    t = _one(
        _db().table("tournaments").select("*")
        .eq("id", tournament_id).eq("status", "approved")
        .limit(1).execute()
    )
    if not t:
        # Deliberately the same answer for "doesn't exist" and "exists
        # but isn't approved". A draft shouldn't be discoverable by
        # watching which ids return 403 instead of 404.
        raise HTTPException(status_code=404, detail="Tournament not found")

    teams = _team_lookup(tournament_id)
    fixtures_raw = _rows(
        _db().table("fixtures").select("*")
        .eq("tournament_id", tournament_id)
        .order("kickoff_at").execute()
    )

    fixtures = []
    for fx in fixtures_raw:
        home = teams.get(fx["home_team_id"], {})
        away = teams.get(fx["away_team_id"], {})
        fixtures.append({
            "id":          fx["id"],
            "round":       fx.get("round"),
            "group_name":  fx.get("group_name"),
            "kickoff_at":  fx.get("kickoff_at"),
            "venue":       fx.get("venue"),
            "status":      fx.get("status"),
            "home_team":   home.get("name"),
            "home_crest":  home.get("crest_url"),
            "home_team_id": fx.get("home_team_id"),
            "away_team":   away.get("name"),
            "away_crest":  away.get("crest_url"),
            "away_team_id": fx.get("away_team_id"),
            "home_score":  fx.get("home_score"),
            "away_score":  fx.get("away_score"),
        })

    groups = sorted({t_["group_name"] for t_ in teams.values() if t_.get("group_name")})
    if groups:
        tables = {
            g: _standings(
                tournament_id,
                {k: v for k, v in teams.items() if v.get("group_name") == g},
                fixtures_raw, t.get("tiebreakers"),
            )
            for g in groups
        }
        standings = None
    else:
        tables = None
        standings = _standings(tournament_id, teams, fixtures_raw, t.get("tiebreakers"))

    result = {
        "_cached_at":  time.time(),
        "tournament":  t,
        "teams":       list(teams.values()),
        "fixtures":    fixtures,
        "standings":   standings,
        "group_tables": tables,
        # Which tiebreakers actually ran. head_to_head is in the schema
        # default but is not implemented, so it will be absent here.
        "tiebreakers_applied": [
            x for x in (t.get("tiebreakers") or DEFAULT_TIEBREAKERS)
            if x in {"goal_difference", "goals_scored", "goals_for", "wins"}
        ],
        "cached": False,
    }
    cache_write(cache_key, result)
    return result


@router.get("/tournaments/{tournament_id}/fixtures/{fixture_id}")
def public_fixture(tournament_id: str, fixture_id: str):
    """One match, with its event timeline. Scout's match page for a
    local tournament."""
    t = _one(
        _db().table("tournaments").select("id")
        .eq("id", tournament_id).eq("status", "approved").limit(1).execute()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    fx = _one(
        _db().table("fixtures").select("*")
        .eq("id", fixture_id).eq("tournament_id", tournament_id).limit(1).execute()
    )
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found")

    teams = _team_lookup(tournament_id)
    events = _rows(
        _db().table("match_events")
        .select("id, type, minute, tournament_team_id, "
                "players!match_events_player_id_fkey(id, first_name, last_name)")
        .eq("fixture_id", fixture_id)
        .order("minute")
        .execute()
    )
    for e in events:
        e["side"] = "home" if e["tournament_team_id"] == fx["home_team_id"] else "away"

    return {
        "fixture": {
            **fx,
            "home_team": teams.get(fx["home_team_id"], {}).get("name"),
            "away_team": teams.get(fx["away_team_id"], {}).get("name"),
            "home_crest": teams.get(fx["home_team_id"], {}).get("crest_url"),
            "away_crest": teams.get(fx["away_team_id"], {}).get("crest_url"),
        },
        "events": events,
    }
