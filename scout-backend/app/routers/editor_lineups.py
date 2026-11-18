"""
app/routers/editor_lineups.py

Team sheets for a local fixture: who started, who was on the bench, and
the shape.
"""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import require_user
from app.notifications import notify_local_lineup_confirmed
from app.routers.editor import (
    _db, _rows, _one, _owned_tournament, _require_editable,
)

router = APIRouter()

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
    fx = _one(
        _db().table("fixtures").select("*").eq("id", fixture_id).limit(1).execute()
    )
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found")

    t = _owned_tournament(fx["tournament_id"], user, need="editor")
    _require_editable(t)
    return fx


def _squad(tournament_team_id: str) -> list[dict]:
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
def set_lineup(
    fixture_id: str,
    body: SheetIn,
    background_tasks: BackgroundTasks,
    user: dict = Depends(require_user),
):
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

    if len(body.starters) > 0:
        background_tasks.add_task(
            notify_local_lineup_confirmed, fixture_id, body.tournament_team_id
        )

    return get_lineup(fixture_id, user)


@router.delete("/editor/fixtures/{fixture_id}/lineup/{tournament_team_id}",
               status_code=204)
def clear_lineup(fixture_id: str, tournament_team_id: str,
                 user: dict = Depends(require_user)):
    fx = _fixture_for_edit(fixture_id, user)
    side = "home" if tournament_team_id == fx["home_team_id"] else "away"
    _db().table("fixture_lineups").delete() \
        .eq("fixture_id", fixture_id).eq("tournament_team_id", tournament_team_id).execute()
    _db().table("fixtures").update({f"{side}_formation": None}).eq("id", fixture_id).execute()
    return None