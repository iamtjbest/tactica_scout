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
import math
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
        .select("*, clubs(id, name, short_name, crest_url)")
        .eq("tournament_id", tournament_id).execute()
    )
    out = {}
    for r in rows:
        club = r.get("clubs") or {}
        out[r["id"]] = {
            "team_id":        r["id"],
            "club_id":        club.get("id"),
            "name":           club.get("name") or "Unknown",
            "short_name":     club.get("short_name"),
            "crest_url":      club.get("crest_url"),
            "group_name":     r.get("group_name"),
            "attack_rating":  r.get("attack_rating"),
            "defence_rating": r.get("defence_rating"),
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

    goal_counts: dict[str, dict] = {}
    assist_counts: dict[str, dict] = {}
    fixture_ids = [f["id"] for f in fixtures_raw]
    if fixture_ids:
        event_rows = _rows(
            _db().table("match_events")
            .select("type, player_id, related_player_id, tournament_team_id")
            .in_("fixture_id", fixture_ids)
            .in_("type", ["goal", "penalty_scored"])
            .execute()
        )
        for event in event_rows:
            player_id = event.get("player_id")
            assist_id = event.get("related_player_id")
            team_id = event.get("tournament_team_id")
            if player_id:
                scorer = goal_counts.setdefault(player_id, {"value": 0, "team_id": team_id})
                scorer["value"] += 1
            if assist_id:
                assister = assist_counts.setdefault(assist_id, {"value": 0, "team_id": team_id})
                assister["value"] += 1

    stat_player_ids = sorted(set(goal_counts) | set(assist_counts))
    players_by_id = {}
    if stat_player_ids:
        players_by_id = {
            player["id"]: player
            for player in _rows(
                _db().table("players").select("id, first_name, last_name, photo_url")
                .in_("id", stat_player_ids).execute()
            )
        }

    def rank_stats(bucket: dict[str, dict]) -> list[dict]:
        ranked = []
        for player_id, info in bucket.items():
            player = players_by_id.get(player_id) or {}
            team = teams.get(info["team_id"], {})
            name = f"{player.get('first_name', '')} {player.get('last_name', '')}".strip() or "Unknown"
            ranked.append({
                "player_id": player_id,
                "player_name": name,
                "photo_url": player.get("photo_url"),
                "team_id": info["team_id"],
                "team_name": team.get("name") or "Unknown",
                "team_crest": team.get("crest_url"),
                "value": info["value"],
            })
        ranked.sort(key=lambda item: (-item["value"], item["player_name"].lower()))
        return ranked[:20]

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
        "top_scorers": rank_stats(goal_counts),
        "top_assists": rank_stats(assist_counts),
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


def _poisson_pmf(k: int, lam: float) -> float:
    if lam <= 0:
        return 1.0 if k == 0 else 0.0
    return (lam ** k) * math.exp(-lam) / math.factorial(k)


def _local_prediction(fx: dict, teams: dict[str, dict], all_fixtures: list[dict]) -> dict:
    """Campus-calibrated bivariate Poisson win probabilities + dynamic ATK/DEF."""
    BASE = 54.0
    AVG_GOALS = 1.25

    stats = {
        tid: {
            "gf": 0, "ga": 0, "mp": 0,
            "seed_atk": float(t.get("attack_rating") or BASE),
            "seed_def": float(t.get("defence_rating") or BASE),
        }
        for tid, t in teams.items()
    }

    finished = [
        f for f in all_fixtures
        if str(f.get("status") or "").lower() in FINISHED
        and f.get("id") != fx.get("id")
        and f.get("home_score") is not None
        and f.get("away_score") is not None
    ]

    total_goals = 0
    total_team_games = 0
    for f in finished:
        h, a = f.get("home_team_id"), f.get("away_team_id")
        hs, as_ = int(f["home_score"]), int(f["away_score"])
        if h in stats:
            stats[h]["gf"] += hs; stats[h]["ga"] += as_; stats[h]["mp"] += 1
            total_goals += hs; total_team_games += 1
        if a in stats:
            stats[a]["gf"] += as_; stats[a]["ga"] += hs; stats[a]["mp"] += 1
            total_goals += as_; total_team_games += 1

    league_mu = (total_goals / total_team_games) if total_team_games >= 4 else AVG_GOALS
    league_mu = max(0.75, min(2.5, league_mu))

    def rating_for(tid: str) -> tuple[int, int]:
        st = stats.get(tid)
        if not st:
            return int(BASE), int(BASE)
        mp = st["mp"]
        if mp == 0:
            return round(st["seed_atk"]), round(st["seed_def"])
        emp_atk = max(45.0, min(75.0, BASE + ((st["gf"] / mp) - league_mu) * 6.5))
        emp_def = max(45.0, min(75.0, BASE + (league_mu - (st["ga"] / mp)) * 6.5))
        w = min(1.0, mp / 5.0)
        return (
            round((1.0 - w) * st["seed_atk"] + w * emp_atk),
            round((1.0 - w) * st["seed_def"] + w * emp_def),
        )

    hid, aid = fx["home_team_id"], fx["away_team_id"]
    h_atk, h_def = rating_for(hid)
    a_atk, a_def = rating_for(aid)

    lam_h = max(0.25, min(4.5, league_mu * (h_atk / BASE) * (BASE / max(45.0, a_def))))
    lam_a = max(0.25, min(4.5, league_mu * (a_atk / BASE) * (BASE / max(45.0, h_def))))

    p_home = p_draw = p_away = 0.0
    for i in range(7):
        pi = _poisson_pmf(i, lam_h)
        for j in range(7):
            pj = _poisson_pmf(j, lam_a)
            p = pi * pj
            if i > j:
                p_home += p
            elif i == j:
                p_draw += p
            else:
                p_away += p

    total_p = p_home + p_draw + p_away or 1.0
    home_pct = round((p_home / total_p) * 100, 1)
    draw_pct = round((p_draw / total_p) * 100, 1)
    away_pct = round(max(0.0, 100.0 - home_pct - draw_pct), 1)

    return {
        "home_attack": h_atk,
        "home_defence": h_def,
        "away_attack": a_atk,
        "away_defence": a_def,
        "home_win_prob": home_pct,
        "draw_prob": draw_pct,
        "away_win_prob": away_pct,
    }


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
                "players!match_events_player_id_fkey(id, first_name, last_name, photo_url), "
                "related_player:players!match_events_related_player_id_fkey(id, first_name, last_name)")
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
                "players(id, first_name, last_name, photo_url)")
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
                "photo_url": p.get("photo_url"),
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

    all_fixtures = _rows(
        _db().table("fixtures").select("id, status, home_team_id, away_team_id, home_score, away_score")
        .eq("tournament_id", tournament_id).execute()
    )
    prediction = _local_prediction(fx, teams, all_fixtures)

    official_motm = None
    motm_pid = fx.get("official_motm_player_id")
    if motm_pid:
        mp = _one(
            _db().table("players").select("id, first_name, last_name, photo_url")
            .eq("id", motm_pid).limit(1).execute()
        )
        reg = _one(
            _db().table("player_registrations")
            .select("tournament_team_id, jersey_number")
            .eq("player_id", motm_pid)
            .in_("tournament_team_id", [fx["home_team_id"], fx["away_team_id"]])
            .limit(1).execute()
        )
        if mp:
            motm_team = teams.get((reg or {}).get("tournament_team_id", ""), {})
            official_motm = {
                "player_id": mp["id"],
                "name": f"{mp.get('first_name', '')} {mp.get('last_name', '')}".strip() or "Unknown",
                "photo_url": mp.get("photo_url"),
                "shirt_number": (reg or {}).get("jersey_number"),
                "team_name": motm_team.get("name"),
                "side": "home" if (reg or {}).get("tournament_team_id") == fx["home_team_id"] else "away",
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
        "official_motm": official_motm,
        "prediction": prediction,
    }
