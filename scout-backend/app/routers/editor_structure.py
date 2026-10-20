"""
app/routers/editor_structure.py

Venues, sub-competitions and suspensions: the three parts of a
competition that live beside the fixtures rather than inside them.

All three are owner-managed and all three respect the review freeze, so
nothing an admin is reading can shift underneath them.
"""
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import require_user
from app.routers.editor import (
    _db, _rows, _one, _owned_tournament, _require_editable,
)

router = APIRouter()


# ── venues ────────────────────────────────────────────────────────────

class VenueIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    address: str | None = Field(default=None, max_length=300)
    city: str | None = Field(default=None, max_length=120)
    capacity: int | None = Field(default=None, ge=0, le=500_000)


@router.get("/editor/tournaments/{tournament_id}/venues")
def list_venues(tournament_id: str, user: dict = Depends(require_user)):
    _owned_tournament(tournament_id, user, need="editor")
    rows = _rows(
        _db().table("venues").select("*")
        .eq("tournament_id", tournament_id).order("name").execute()
    )
    return {"count": len(rows), "venues": rows}


@router.post("/editor/tournaments/{tournament_id}/venues", status_code=201)
def add_venue(tournament_id: str, body: VenueIn, user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)

    # Checked here as well as by the unique index, so the organiser gets
    # a sentence instead of a database error.
    existing = _rows(
        _db().table("venues").select("id, name")
        .eq("tournament_id", tournament_id).execute()
    )
    if any((v["name"] or "").strip().lower() == body.name.strip().lower() for v in existing):
        raise HTTPException(status_code=409, detail=f"'{body.name}' is already a venue here.")

    return _one(_db().table("venues").insert({
        "tournament_id": tournament_id,
        "name": body.name.strip(),
        "address": body.address,
        "city": body.city,
        "capacity": body.capacity,
    }).execute())


@router.patch("/editor/tournaments/{tournament_id}/venues/{venue_id}")
def update_venue(tournament_id: str, venue_id: str, body: VenueIn,
                 user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)

    updated = _one(
        _db().table("venues")
        .update({
            "name": body.name.strip(), "address": body.address,
            "city": body.city, "capacity": body.capacity,
        })
        .eq("id", venue_id).eq("tournament_id", tournament_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Venue not found")

    # Fixtures carry the venue name as text for every existing reader, so
    # a rename has to reach them or the fixture list shows the old name.
    _db().table("fixtures").update({"venue": body.name.strip()}) \
        .eq("tournament_id", tournament_id).eq("venue_id", venue_id).execute()
    return updated


@router.delete("/editor/tournaments/{tournament_id}/venues/{venue_id}", status_code=204)
def delete_venue(tournament_id: str, venue_id: str, user: dict = Depends(require_user)):
    """Remove a venue.

    Fixtures played there keep their venue TEXT and lose only the link
    (the FK is `on delete set null`). Deleting a ground should not wipe
    the record of where matches were played.
    """
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)
    _db().table("venues").delete() \
        .eq("id", venue_id).eq("tournament_id", tournament_id).execute()
    return None


# ── sub-competitions ──────────────────────────────────────────────────

KINDS = {"league", "group", "knockout", "playoff"}


class SubCompIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    kind: str = "group"
    sort_order: int = 0


def _sync_group_name(tournament_id: str, sub_id: str, name: str):
    """Keep tournament_teams.group_name equal to the sub-competition's
    name.

    group_name is what standings, fixture generation and the public
    endpoint all read. The sub-competition table is the editable record;
    group_name stays the working index, and these two must never
    disagree or a group silently empties out of the table.
    """
    _db().table("tournament_teams").update({"group_name": name}) \
        .eq("tournament_id", tournament_id).eq("sub_competition_id", sub_id).execute()


@router.get("/editor/tournaments/{tournament_id}/sub-competitions")
def list_subs(tournament_id: str, user: dict = Depends(require_user)):
    _owned_tournament(tournament_id, user, need="editor")
    subs = _rows(
        _db().table("sub_competitions").select("*")
        .eq("tournament_id", tournament_id)
        .order("sort_order").order("name").execute()
    )
    teams = _rows(
        _db().table("tournament_teams")
        .select("id, sub_competition_id, group_name, clubs(id, name, crest_url)")
        .eq("tournament_id", tournament_id).execute()
    )
    by_sub: dict[str, list] = {}
    for tm in teams:
        by_sub.setdefault(tm.get("sub_competition_id") or "", []).append(tm)

    for s in subs:
        s["teams"] = by_sub.get(s["id"], [])
    return {
        "count": len(subs),
        "sub_competitions": subs,
        # Teams not yet placed. Shown separately so an organiser can see
        # at a glance that someone is missing from the draw.
        "unassigned": by_sub.get("", []),
    }


@router.post("/editor/tournaments/{tournament_id}/sub-competitions", status_code=201)
def add_sub(tournament_id: str, body: SubCompIn, user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)
    if body.kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of: {', '.join(sorted(KINDS))}")

    existing = _rows(
        _db().table("sub_competitions").select("id, name")
        .eq("tournament_id", tournament_id).execute()
    )
    if any((x["name"] or "").strip().lower() == body.name.strip().lower() for x in existing):
        raise HTTPException(status_code=409, detail=f"'{body.name}' already exists here.")

    return _one(_db().table("sub_competitions").insert({
        "tournament_id": tournament_id,
        "name": body.name.strip(),
        "kind": body.kind,
        "sort_order": body.sort_order,
    }).execute())


@router.patch("/editor/tournaments/{tournament_id}/sub-competitions/{sub_id}")
def update_sub(tournament_id: str, sub_id: str, body: SubCompIn,
               user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)
    if body.kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of: {', '.join(sorted(KINDS))}")

    updated = _one(
        _db().table("sub_competitions")
        .update({"name": body.name.strip(), "kind": body.kind, "sort_order": body.sort_order})
        .eq("id", sub_id).eq("tournament_id", tournament_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    _sync_group_name(tournament_id, sub_id, body.name.strip())
    return updated


@router.delete("/editor/tournaments/{tournament_id}/sub-competitions/{sub_id}",
               status_code=204)
def delete_sub(tournament_id: str, sub_id: str, user: dict = Depends(require_user)):
    """Remove a part of the competition. Its teams become unassigned
    rather than being deleted with it."""
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)
    _db().table("tournament_teams") \
        .update({"sub_competition_id": None, "group_name": None}) \
        .eq("tournament_id", tournament_id).eq("sub_competition_id", sub_id).execute()
    _db().table("sub_competitions").delete() \
        .eq("id", sub_id).eq("tournament_id", tournament_id).execute()
    return None


class AssignIn(BaseModel):
    team_ids: list[str]


@router.post("/editor/tournaments/{tournament_id}/sub-competitions/{sub_id}/teams")
def assign_teams(tournament_id: str, sub_id: str, body: AssignIn,
                 user: dict = Depends(require_user)):
    """Put these teams in this part of the competition.

    Writes both the link and group_name together, because standings read
    the latter and the two drifting apart is the failure that would be
    hardest to spot: the table would simply be missing a team.
    """
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)

    sub = _one(
        _db().table("sub_competitions").select("*")
        .eq("id", sub_id).eq("tournament_id", tournament_id).limit(1).execute()
    )
    if not sub:
        raise HTTPException(status_code=404, detail="Not found")

    for team_id in body.team_ids:
        _db().table("tournament_teams").update({
            "sub_competition_id": sub_id, "group_name": sub["name"],
        }).eq("id", team_id).eq("tournament_id", tournament_id).execute()

    return {"assigned": len(body.team_ids), "sub_competition": sub}


@router.delete("/editor/tournaments/{tournament_id}/teams/{team_id}/sub-competition",
               status_code=200)
def unassign_team(tournament_id: str, team_id: str, user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)
    updated = _one(
        _db().table("tournament_teams")
        .update({"sub_competition_id": None, "group_name": None})
        .eq("id", team_id).eq("tournament_id", tournament_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Team not found")
    return updated


# ── suspensions ───────────────────────────────────────────────────────

class SuspensionIn(BaseModel):
    tournament_team_id: str
    player_id: str
    matches: int = Field(default=1, ge=1, le=50)
    start_date: date | None = None
    reason: str | None = Field(default=None, max_length=500)


@router.get("/editor/tournaments/{tournament_id}/suspensions")
def list_suspensions(tournament_id: str, include_served: bool = False,
                     user: dict = Depends(require_user)):
    _owned_tournament(tournament_id, user, need="editor")
    q = (
        _db().table("suspensions")
        .select("*, players(id, first_name, last_name), "
                "tournament_teams(id, clubs(id, name, crest_url))")
        .eq("tournament_id", tournament_id)
    )
    if not include_served:
        q = q.eq("active", True)
    rows = _rows(q.order("start_date", desc=True).execute())
    return {"count": len(rows), "suspensions": rows}


@router.post("/editor/tournaments/{tournament_id}/suspensions", status_code=201)
def add_suspension(tournament_id: str, body: SuspensionIn,
                   user: dict = Depends(require_user)):
    """Ban a player for a number of matches.

    An editor can log one, not just the owner: the person who sends a
    player off is the one at the pitch, and making them message the
    organiser to record it is how bans get forgotten.
    """
    t = _owned_tournament(tournament_id, user, need="editor")
    _require_editable(t)

    team = _one(
        _db().table("tournament_teams").select("id")
        .eq("id", body.tournament_team_id).eq("tournament_id", tournament_id)
        .limit(1).execute()
    )
    if not team:
        raise HTTPException(status_code=404, detail="That team isn't in this competition.")

    registered = _rows(
        _db().table("player_registrations").select("id")
        .eq("tournament_team_id", body.tournament_team_id)
        .eq("player_id", body.player_id).limit(1).execute()
    )
    if not registered:
        raise HTTPException(
            status_code=400,
            detail="That player isn't registered to that team in this competition.",
        )

    return _one(_db().table("suspensions").insert({
        "tournament_id": tournament_id,
        "tournament_team_id": body.tournament_team_id,
        "player_id": body.player_id,
        "matches": body.matches,
        "start_date": (body.start_date or date.today()).isoformat(),
        "reason": body.reason,
    }).execute())


@router.post("/editor/tournaments/{tournament_id}/suspensions/{suspension_id}/served")
def mark_served(tournament_id: str, suspension_id: str,
                user: dict = Depends(require_user)):
    """Close a ban out. Kept as a record rather than deleted, so the
    disciplinary history of a competition survives."""
    t = _owned_tournament(tournament_id, user, need="editor")
    _require_editable(t)
    updated = _one(
        _db().table("suspensions").update({"active": False})
        .eq("id", suspension_id).eq("tournament_id", tournament_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Not found")
    return updated


@router.delete("/editor/tournaments/{tournament_id}/suspensions/{suspension_id}",
               status_code=204)
def delete_suspension(tournament_id: str, suspension_id: str,
                      user: dict = Depends(require_user)):
    """For one logged by mistake. Serving a ban is `served`, not this."""
    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)
    _db().table("suspensions").delete() \
        .eq("id", suspension_id).eq("tournament_id", tournament_id).execute()
    return None
