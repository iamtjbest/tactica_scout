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

# Used when a tournament predates the points_rules column, or has it
# empty. Three for a win is the near-universal modern default, and it is
# what every existing table was already calculated with, so falling back
# to it changes nothing for anyone.
DEFAULT_POINTS = {"win": 3, "draw": 1, "loss": 0}


def _points(rules: dict | None) -> dict:
    """Whole, sane points values, whatever is in the column.

    A table is the thing an organiser gets shouted at about, so a
    malformed value falls back to the standard rather than producing
    a nonsense column or a 500 in the middle of a matchday.
    """
    r = rules or {}
    out = {}
    for k in ("win", "draw", "loss"):
        try:
            v = int(r[k])
        except (KeyError, TypeError, ValueError):
            return dict(DEFAULT_POINTS)
        if not 0 <= v <= 10:
            return dict(DEFAULT_POINTS)
        out[k] = v
    if not (out["win"] >= out["draw"] >= out["loss"]):
        return dict(DEFAULT_POINTS)
    return out


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
               fixtures: list[dict], tiebreakers: list[str],
               points_rules: dict | None = None) -> list[dict]:
    """League table from finished fixtures only.

    Points come from the competition's own rules rather than a constant:
    3-1-0 is near-universal but plenty of school and five-a-side
    competitions run 2-1-0, and a hard-coded table makes those unusable.

    A match that is live, postponed or has a missing score contributes
    nothing: half a result is not a result, and counting a live 1-0 as
    final makes the table jump around while people are looking at it.
    """
    pts = _points(points_rules)
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
                row["won"] += 1;   row["points"] += pts["win"];  row["form"].append("W")
            elif gf == ga:
                row["drawn"] += 1; row["points"] += pts["draw"]; row["form"].append("D")
            else:
                row["lost"] += 1;  row["points"] += pts["loss"]; row["form"].append("L")

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
                fixtures_raw, t.get("tiebreakers"), t.get("points_rules"),
            )
            for g in groups
        }
        standings = None
    else:
        tables = None
        standings = _standings(tournament_id, teams, fixtures_raw,
                               t.get("tiebreakers"), t.get("points_rules"))

    result = {
        "_cached_at":  time.time(),
        "tournament":  t,
        "teams":       list(teams.values()),
        "fixtures":    fixtures,
        "standings":   standings,
        "group_tables": tables,
        # Which tiebreakers actually ran. head_to_head is in the schema
        # default but is not implemented, so it will be absent here.
        "points_rules": _points(t.get("points_rules")),
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

    # The team sheet, so Scout can draw a pitch and offer every player
    # for rating rather than only the ones who got an incident logged.
    sheet = _rows(
        _db().table("fixture_lineups")
        .select("player_id, tournament_team_id, role, shirt_number, position, "
                "players(id, first_name, last_name)")
        .eq("fixture_id", fixture_id).execute()
    )

    def side_sheet(team_id: str, role: str) -> list[dict]:
        out = []
        for r in sheet:
            if r["tournament_team_id"] != team_id or r["role"] != role:
                continue
            p = r.get("players") or {}
            out.append({
                "player_id": r["player_id"],
                "name": f"{p.get('first_name','')} {p.get('last_name','')}".strip() or "Unknown",
                "shirt_number": r.get("shirt_number"),
                "position": r.get("position"),
            })
        return out

    lineups = {
        "home": {
            "formation": fx.get("home_formation"),
            "starters": side_sheet(fx["home_team_id"], "starter"),
            "substitutes": side_sheet(fx["home_team_id"], "substitute"),
        },
        "away": {
            "formation": fx.get("away_formation"),
            "starters": side_sheet(fx["away_team_id"], "starter"),
            "substitutes": side_sheet(fx["away_team_id"], "substitute"),
        },
    }

    return {
        "fixture": {
            **fx,
            "home_team": teams.get(fx["home_team_id"], {}).get("name"),
            "away_team": teams.get(fx["away_team_id"], {}).get("name"),
            "home_crest": teams.get(fx["home_team_id"], {}).get("crest_url"),
            "away_crest": teams.get(fx["away_team_id"], {}).get("crest_url"),
        },
        "lineups": lineups,
        "lineup_status": "confirmed" if sheet else "unavailable",
        "events": events,
    }


# Goals that count as a goal for the scorer. An own goal is deliberately
# not here: it belongs to the opposition's score, not to the player's
# tally, and crediting it would be the kind of error an organiser gets
# shouted at about.
SCORING_EVENTS = ("goal", "penalty_scored")


@router.get("/tournaments/{tournament_id}/players/{player_id}")
def public_tournament_player(tournament_id: str, player_id: str):
    """One player's profile inside a tournament.

    This is what opens when someone taps a name on the pitch in Scout:
    who they are, who they play for, and what they have actually done
    in this competition. Stats are counted from match_events on read,
    for the same reason standings are: a stored tally drifts the moment
    an organiser fixes a scoreline.

    Scoped to the tournament, not the player's whole career. A schools
    competition and a church league share the players table, and a
    cross-tournament total on a tournament page would be a lie about
    what the reader is looking at.
    """
    t = _one(
        _db().table("tournaments").select("id")
        .eq("id", tournament_id).eq("status", "approved").limit(1).execute()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")

    player = _one(
        _db().table("players")
        .select("id, first_name, last_name, position, photo_url, nationality")
        .eq("id", player_id).limit(1).execute()
    )
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    teams = _team_lookup(tournament_id)
    if not teams:
        raise HTTPException(status_code=404, detail="Player not in this tournament")

    # The registration is what ties a player to this tournament at all.
    # Without one they are simply not part of it, whatever the players
    # table says, so this doubles as the authorisation check.
    regs = [
        r for r in _rows(
            _db().table("player_registrations")
            .select("tournament_team_id, jersey_number, position")
            .eq("player_id", player_id).execute()
        )
        if r["tournament_team_id"] in teams
    ]
    if not regs:
        raise HTTPException(status_code=404, detail="Player not in this tournament")

    reg = regs[0]
    team = teams[reg["tournament_team_id"]]

    fixtures = _rows(
        _db().table("fixtures").select("id, status")
        .eq("tournament_id", tournament_id).execute()
    )
    fixture_ids = [f["id"] for f in fixtures]

    goals = assists = yellows = reds = 0
    if fixture_ids:
        scored = _rows(
            _db().table("match_events").select("id, type")
            .in_("fixture_id", fixture_ids).eq("player_id", player_id).execute()
        )
        for e in scored:
            if e["type"] in SCORING_EVENTS:
                goals += 1
            elif e["type"] == "yellow":
                yellows += 1
            elif e["type"] in ("red", "second_yellow"):
                reds += 1

        # An assist is not its own event type. It is the related player
        # on somebody else's goal.
        helped = _rows(
            _db().table("match_events").select("id, type")
            .in_("fixture_id", fixture_ids)
            .eq("related_player_id", player_id).execute()
        )
        assists = sum(1 for e in helped if e["type"] in SCORING_EVENTS)

    # Appearances come from the team sheet, so a player who came on and
    # did nothing still shows up as having played.
    appearances = starts = 0
    if fixture_ids:
        sheets = _rows(
            _db().table("fixture_lineups").select("fixture_id, role, shirt_number")
            .in_("fixture_id", fixture_ids).eq("player_id", player_id).execute()
        )
        appearances = len({r["fixture_id"] for r in sheets})
        starts = len({r["fixture_id"] for r in sheets if r["role"] == "starter"})

    name = f"{player.get('first_name','')} {player.get('last_name','')}".strip()
    return {
        "player": {
            "id": player["id"],
            "name": name or "Unknown",
            "first_name": player.get("first_name"),
            "last_name": player.get("last_name"),
            # The registration's position is the one the organiser set
            # for this competition; the players row is the general one.
            "position": reg.get("position") or player.get("position"),
            "photo_url": player.get("photo_url"),
            "nationality": player.get("nationality"),
            "shirt_number": reg.get("jersey_number"),
        },
        "team": {
            "team_id": team["team_id"],
            "name": team["name"],
            "short_name": team["short_name"],
            "crest_url": team["crest_url"],
            "group_name": team["group_name"],
        },
        "tournament_id": tournament_id,
        "stats": {
            "appearances": appearances,
            "starts": starts,
            "goals": goals,
            "assists": assists,
            "yellow_cards": yellows,
            "red_cards": reds,
        },
    }
