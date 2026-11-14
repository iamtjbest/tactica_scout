import logging

from fastapi import APIRouter
from app.config import bsd_get

router = APIRouter()
logger = logging.getLogger(__name__)

# BSD's /teams/ and /players/ name search returns matches in whatever
# order it stores them, not by relevance -- so a query like "inter"
# (which also matches Inter Miami, Internacional, Inter Baku, etc.) can
# push a well-known club like Inter Milan past the first 5 results if
# BSD happens to list the others first. Fixed by asking BSD for a wider
# batch, then ranking it ourselves before trimming to the top 5 we
# actually send to the app: exact name match first, then "starts with",
# then plain "contains" -- same order a person would expect.
FETCH_LIMIT = 25
RESULT_LIMIT = 5


def _rank(name: str, q: str) -> int:
    name_l = (name or "").lower()
    q_l = q.lower()
    if name_l == q_l:
        return 0
    if name_l.startswith(q_l):
        return 1
    # an exact word match ("inter" matching the "Inter" in "Inter Milan")
    # ranks above a mid-word contains ("inter" inside "Winterthur")
    if q_l in name_l.split():
        return 2
    return 3


@router.get("/search")
def global_search(q: str):
    if not q or len(q) < 2:
        return {"tournaments": [], "teams": [], "players": []}

    teams_data = bsd_get("/teams/", params={"name": q, "limit": FETCH_LIMIT})
    players_data = bsd_get("/players/", params={"name": q, "limit": FETCH_LIMIT})

    teams = []
    if isinstance(teams_data, dict):
        results = teams_data.get("results") or teams_data.get("teams") or []
    elif isinstance(teams_data, list):
        results = teams_data
    else:
        results = []
    for t in results:
        teams.append({
            "id": t.get("id"),
            "name": t.get("name"),
            "country": t.get("country", "")
        })
    teams.sort(key=lambda t: _rank(t["name"], q))

    players = []
    if isinstance(players_data, dict):
        results = players_data.get("results") or players_data.get("players") or []
    elif isinstance(players_data, list):
        results = players_data
    else:
        results = []
    for p in results:
        players.append({
            "id": p.get("id"),
            "name": p.get("name"),
            "nationality": p.get("nationality", ""),
            "team": p.get("current_team", {}).get("name") if p.get("current_team") else ""
        })
    players.sort(key=lambda p: _rank(p["name"], q))

    local_tournaments = []
    try:
        from app.routers.editor import _db, _rows

        tournament_rows = _rows(
            _db().table("tournaments")
            .select("id, name, country, level, organizing_body")
            .eq("status", "approved")
            .ilike("name", f"%{q}%")
            .limit(5).execute()
        )
        local_tournaments = [
            {
                "id": t["id"], "name": t["name"],
                "country": t.get("country", ""), "level": t.get("level", ""),
                "organizing_body": t.get("organizing_body", ""), "source": "local",
            }
            for t in tournament_rows
        ]

        approved = _rows(
            _db().table("tournaments")
            .select("id, name").eq("status", "approved").execute()
        )
        tournaments_by_id = {t["id"]: t for t in approved}
        if tournaments_by_id:
            local_teams = _rows(
                _db().table("tournament_teams")
                .select("id, tournament_id, clubs(name)")
                .in_("tournament_id", list(tournaments_by_id)).execute()
            )
            teams_by_id = {team["id"]: team for team in local_teams}
            if teams_by_id:
                registrations = _rows(
                    _db().table("player_registrations")
                    .select("player_id, tournament_team_id")
                    .in_("tournament_team_id", list(teams_by_id)).execute()
                )
                local_player_teams = {}
                for registration in registrations:
                    local_player_teams.setdefault(registration["player_id"], registration["tournament_team_id"])
                if local_player_teams:
                    local_players = _rows(
                        _db().table("players")
                        .select("id, first_name, last_name, position, photo_url")
                        .in_("id", list(local_player_teams))
                        .or_(f"first_name.ilike.%{q}%,last_name.ilike.%{q}%")
                        .limit(RESULT_LIMIT).execute()
                    )
                    for player in local_players:
                        team = teams_by_id[local_player_teams[player["id"]]]
                        tournament = tournaments_by_id[team["tournament_id"]]
                        name = f"{player.get('first_name', '')} {player.get('last_name', '')}".strip()
                        players.append({
                            "id": player["id"], "name": name,
                            "nationality": "", "team": (team.get("clubs") or {}).get("name", ""),
                            "position": player.get("position"), "photo_url": player.get("photo_url"),
                            "source": "local", "tournament_id": tournament["id"],
                            "tournament_name": tournament["name"],
                        })
        players.sort(key=lambda player: _rank(player.get("name"), q))
    except Exception:
        logger.exception("Could not include local tournament data in global search")

    return {
        "tournaments": local_tournaments,
        "teams": teams[:RESULT_LIMIT],
        "players": players[:RESULT_LIMIT],
    }
