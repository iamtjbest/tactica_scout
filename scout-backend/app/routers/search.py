from fastapi import APIRouter
from app.config import bsd_get

router = APIRouter()

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
        return {"teams": [], "players": []}

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

    return {
        "teams": teams[:RESULT_LIMIT],
        "players": players[:RESULT_LIMIT]
    }
