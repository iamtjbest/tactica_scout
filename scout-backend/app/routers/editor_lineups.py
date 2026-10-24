"""
app/routers/editor_lineups.py

Team sheets for a local fixture: who started, who was on the bench, and
the shape.

This is what makes crowd ratings work for a local competition. Before
it, the only players a fan could rate were the ones the organiser
happened to log a goal or a card against, so a player could have the
game of his life, touch nothing recorded, and be unratable.

Entered by the organiser or a match editor from the fixture screen,
which is reachable from the dashboard as soon as the competition is
approved.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import require_user
from app.routers.editor import (
    _db, _rows, _one, _owned_tournament, _require_editable,
)

router = APIRouter()

# Eleven on the pitch. Enforced so a mis-tap can't publish a twelve-man
# XI that then renders as a nonsense formation.
MAX_STARTERS = 11
MAX_SUBS = 12


class SheetPlayer(BaseModel):
    player_id: str
    shirt_number: int | None = Field(default=None, ge=1, le=99)
    position: str | None = Field(default=None, max_length=20)


class SheetIn(BaseModel):
    tournament_team_id: str
    formation: str | None = Field(default=None, max_length=12)
    starters: list[SheetPlayer] = []
    substitutes: list[SheetPlayer] = []


def _fixture_for_edit(fixture_id: str, user: dict) -> dict:
    """Load a fixture and prove this user may change it.

    An editor can set a team sheet, not just the owner: the person at
    the pitch with the paper team sheet is the one who should be typing
    it in.
    """
    fx = _one(
        _db().table("fixtures").select("*").eq("id", fixture_id).limit(1).execute()
    )
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found")

    t = _owned_tournament(fx["tournament_id"], user, need="editor")
    _require_editable(t)
    return fx


def _squad(tournament_team_id: str) -> list[dict]:
    """Everyone registered to this team for the competition."""
    return _rows(
        _db().table("player_registrations")
        .select("id, jersey_number, position, players(id, first_name, last_name)")
        .eq("tournament_team_id", tournament_team_id).execute()
    )


def _sheet(fixture_id: str) -> list[dict]:
    return _rows(
        _db().table("fixture_lineups")
        .select("*, players(id, first_name, last_name)")
        .eq("fixture_id", fixture_id).execute()
    )


@router.get("/editor/fixtures/{fixture_id}/lineup")
def get_lineup(fixture_id: str, user: dict = Depends(require_user)):
    """The team sheet as it stands, plus each side's registered squad so
    the editor can show a pick-list without a second request."""
    fx = _one(
        _db().table("fixtures").select("*").eq("id", fixture_id).limit(1).execute()
    )
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found")
    _owned_tournament(fx["tournament_id"], user, need="editor")

    rows = _sheet(fixture_id)
    by_team: dict[str, dict] = {}
    for side_key, team_id, formation in (
        ("home", fx["home_team_id"], fx.get("home_formation")),
        ("away", fx["away_team_id"], fx.get("away_formation")),
    ):
        picked = [r for r in rows if r["tournament_team_id"] == team_id]
        by_team[side_key] = {
            "tournament_team_id": team_id,
            "formation": formation,
            "starters": [r for r in picked if r["role"] == "starter"],
            "substitutes": [r for r in picked if r["role"] == "substitute"],
            "squad": _squad(team_id),
        }

    return {"fixture": fx, "lineups": by_team}


@router.put("/editor/fixtures/{fixture_id}/lineup")
def set_lineup(fixture_id: str, body: SheetIn, user: dict = Depends(require_user)):
    """Replace one side's team sheet.

    A full replace rather than add/remove calls: a team sheet is written
    once off a piece of paper, and patching it row by row from a phone
    at a pitch is how you end up with a ten-man XI because one request
    failed silently.
    """
    fx = _fixture_for_edit(fixture_id, user)

    if body.tournament_team_id not in (fx["home_team_id"], fx["away_team_id"]):
        raise HTTPException(status_code=400, detail="That team isn't in this fixture.")

    if len(body.starters) > MAX_STARTERS:
        raise HTTPException(
            status_code=400,
            detail=f"A starting XI is {MAX_STARTERS} players, not {len(body.starters)}.",
        )
    if len(body.substitutes) > MAX_SUBS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_SUBS} substitutes.")

    picks = list(body.starters) + list(body.substitutes)
    ids = [p.player_id for p in picks]
    if len(set(ids)) != len(ids):
        raise HTTPException(
            status_code=400,
            detail="A player is listed twice. Someone can't start and be a sub.",
        )

    # Every pick has to be registered to THIS team in THIS competition.
    # Without the check an organiser could name a player from the other
    # side, or one who was never registered at all.
    registered = {
        (r.get("players") or {}).get("id")
        for r in _squad(body.tournament_team_id)
    }
    stray = [p for p in ids if p not in registered]
    if stray:
        raise HTTPException(
            status_code=400,
            detail=f"{len(stray)} of those players aren't registered to that team.",
        )

    # Replace this side only. The other side's sheet is untouched, so two
    # editors can fill in a team each without overwriting one another.
    _db().table("fixture_lineups").delete() \
        .eq("fixture_id", fixture_id) \
        .eq("tournament_team_id", body.tournament_team_id).execute()

    rows = [
        {
            "fixture_id": fixture_id,
            "tournament_team_id": body.tournament_team_id,
            "player_id": p.player_id,
            "role": role,
            "shirt_number": p.shirt_number,
            "position": p.position,
            "created_by": user["id"],
        }
        for role, group in (("starter", body.starters), ("substitute", body.substitutes))
        for p in group
    ]
    if rows:
        _db().table("fixture_lineups").insert(rows).execute()

    side = "home" if body.tournament_team_id == fx["home_team_id"] else "away"
    if body.formation is not None:
        _db().table("fixtures").update({f"{side}_formation": body.formation or None}) \
            .eq("id", fixture_id).execute()

    return get_lineup(fixture_id, user)


@router.delete("/editor/fixtures/{fixture_id}/lineup/{tournament_team_id}",
               status_code=204)
def clear_lineup(fixture_id: str, tournament_team_id: str,
                 user: dict = Depends(require_user)):
    """Wipe one side's sheet, for when it was entered against the wrong
    team."""
    fx = _fixture_for_edit(fixture_id, user)
    side = "home" if tournament_team_id == fx["home_team_id"] else "away"
    _db().table("fixture_lineups").delete() \
        .eq("fixture_id", fixture_id).eq("tournament_team_id", tournament_team_id).execute()
    _db().table("fixtures").update({f"{side}_formation": None}).eq("id", fixture_id).execute()
    return None
