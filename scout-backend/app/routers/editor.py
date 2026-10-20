"""
app/routers/editor.py

The editor app's foundation: tournaments, the clubs playing in them, and
the players registered to those clubs. Shared by editor-web and
editor-mobile, which are two front ends over this one API.

AUTHORIZATION IS ENFORCED HERE, NOT BY THE DATABASE.
Every Scout table has RLS enabled with zero policies, and this backend
talks to Supabase with the service role key, which bypasses RLS
entirely. That is a deliberate design (schema.sql says so), but it means
Postgres will happily let this process read or write ANY row. Nothing
stops one organiser editing another's tournament except the checks in
this file, so every endpoint that touches a tournament goes through
_owned_tournament().

GLOBAL vs PER-TOURNAMENT, worth being clear about because it drives the
shape of everything below:
  clubs   and players  are GLOBAL. A department side and its players
                       persist across tournaments so career stats
                       accumulate, which is the whole point.
  tournament_teams     is the join: this club, in this tournament.
  player_registrations is the join: this player, in that team, this
                       tournament, with the shirt number they wore.
So "add a team" is really "find or create a global club, then enter it".
"""
import re
from datetime import date
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.deps import require_user
from app.supabase import get_supabase

router = APIRouter()


# ── helpers ───────────────────────────────────────────────────────────

def _db():
    return get_supabase()


def _rows(res) -> list[dict]:
    return res.data or []


def _one(res) -> dict | None:
    rows = _rows(res)
    return rows[0] if rows else None


def _norm_name(name: str) -> str:
    """For duplicate detection. Clubs and players are global, so without
    this every organiser creates their own "Mechanical Engineering" and
    career stats fragment across half a dozen near-identical rows."""
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


def _owned_tournament(tournament_id: str, user: dict) -> dict:
    """Load a tournament and prove this user may act on it.

    404 for a missing one, 403 for someone else's. Admins pass. This is
    the only authorization gate in the editor, so it is deliberately
    boring and used everywhere rather than reimplemented per endpoint.
    """
    t = _one(
        _db().table("tournaments").select("*").eq("id", tournament_id).limit(1).execute()
    )
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if t["owner_id"] != user["id"] and user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not your tournament")
    return t


# Statuses where the organiser may still change the tournament's shape.
# Once it's with us for review, or live, adding teams would change what
# was reviewed, so structural edits stop.
EDITABLE_STATUSES = {"draft", "rejected"}


def _require_editable(t: dict):
    if t["status"] not in EDITABLE_STATUSES:
        raise HTTPException(
            status_code=409,
            detail=(
                f"This tournament is '{t['status']}'. Teams and players can only "
                "be changed while it is a draft or after it was rejected."
            ),
        )


# ── models ────────────────────────────────────────────────────────────

class TournamentIn(BaseModel):
    name: str = Field(min_length=3, max_length=120)
    level: str                      # department | faculty | src | open
    gender: str = "male"            # male | female | mixed
    age_category: str | None = None
    country: str = "Nigeria"
    start_date: date
    end_date: date
    format: str                     # league | knockout | groups_knockout
    organizing_body: str = Field(min_length=2, max_length=160)
    organizer_phone: str = Field(min_length=7, max_length=32)
    contact2_name: str | None = None
    contact2_phone: str | None = None
    tiebreakers: list[str] | None = None
    discipline_rules: dict[str, Any] | None = None


class TournamentPatch(BaseModel):
    name: str | None = Field(default=None, min_length=3, max_length=120)
    level: str | None = None
    gender: str | None = None
    age_category: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    format: str | None = None
    organizing_body: str | None = None
    organizer_phone: str | None = None
    contact2_name: str | None = None
    contact2_phone: str | None = None
    tiebreakers: list[str] | None = None
    discipline_rules: dict[str, Any] | None = None


class TeamIn(BaseModel):
    """Either point at an existing global club, or name a new one."""
    club_id: str | None = None
    club_name: str | None = Field(default=None, min_length=2, max_length=120)
    short_name: str | None = None
    institution: str | None = None
    crest_url: str | None = None
    group_name: str | None = None
    home_color: str | None = None
    away_color: str | None = None


class PlayerIn(BaseModel):
    """Same idea: an existing global player, or enough to create one.

    dob is required when creating, by schema design -- 'no placeholders'.
    An age category is meaningless if half the squad has a made-up
    birthday, and these records follow a player across tournaments.
    """
    player_id: str | None = None
    first_name: str | None = Field(default=None, min_length=1, max_length=60)
    last_name: str | None = Field(default=None, min_length=1, max_length=60)
    dob: date | None = None
    position: str | None = None
    photo_url: str | None = None
    nationality: str | None = "Nigeria"
    jersey_number: int | None = Field(default=None, ge=1, le=99)


# ── tournaments ───────────────────────────────────────────────────────

@router.get("/editor/tournaments")
def list_my_tournaments(user: dict = Depends(require_user)):
    """Every tournament this organiser owns, newest first."""
    rows = _rows(
        _db().table("tournaments").select("*")
        .eq("owner_id", user["id"])
        .order("created_at", desc=True)
        .execute()
    )
    return {"count": len(rows), "tournaments": rows}


@router.post("/editor/tournaments", status_code=201)
def create_tournament(body: TournamentIn, user: dict = Depends(require_user)):
    """Create a draft. Nothing is reviewed or published at this point --
    approval gates publishing, not creation, so an organiser can build
    the whole thing before anyone looks at it."""
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="end_date is before start_date")

    row = {
        "owner_id":        user["id"],
        "name":            body.name.strip(),
        "level":           body.level,
        "gender":          body.gender,
        "age_category":    body.age_category,
        "country":         body.country,
        "start_date":      body.start_date.isoformat(),
        "end_date":        body.end_date.isoformat(),
        "format":          body.format,
        "organizing_body": body.organizing_body.strip(),
        "organizer_phone": body.organizer_phone.strip(),
        "contact2_name":   body.contact2_name,
        "contact2_phone":  body.contact2_phone,
        "status":          "draft",
    }
    if body.tiebreakers is not None:
        row["tiebreakers"] = body.tiebreakers
    if body.discipline_rules is not None:
        row["discipline_rules"] = body.discipline_rules

    try:
        created = _one(_db().table("tournaments").insert(row).execute())
    except Exception as e:
        # Most likely an enum value the database doesn't accept. Say
        # which values are legal rather than echoing a Postgres error.
        raise HTTPException(
            status_code=400,
            detail=(
                "Could not create the tournament. Check level is one of "
                "department/faculty/src/open, gender is male/female/mixed, and "
                f"format is league/knockout/groups_knockout. ({type(e).__name__})"
            ),
        )
    return created


@router.get("/editor/tournaments/{tournament_id}")
def get_tournament(tournament_id: str, user: dict = Depends(require_user)):
    """The tournament plus everything hanging off it, in one call, so
    the editor's main screen doesn't need five round trips."""
    t = _owned_tournament(tournament_id, user)

    teams = _rows(
        _db().table("tournament_teams")
        .select("*, clubs(id, name, short_name, crest_url, institution)")
        .eq("tournament_id", tournament_id)
        .execute()
    )
    proofs = _rows(
        _db().table("tournament_proofs").select("*")
        .eq("tournament_id", tournament_id).execute()
    )
    fixtures = _rows(
        _db().table("fixtures").select("*")
        .eq("tournament_id", tournament_id)
        .order("kickoff_at").execute()
    )
    return {
        "tournament": t,
        "teams":      teams,
        "proofs":     proofs,
        "fixtures":   fixtures,
        "counts": {
            "teams":    len(teams),
            "fixtures": len(fixtures),
        },
    }


@router.patch("/editor/tournaments/{tournament_id}")
def update_tournament(tournament_id: str, body: TournamentPatch,
                      user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user)
    _require_editable(t)

    patch = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    for k in ("start_date", "end_date"):
        if k in patch:
            patch[k] = patch[k].isoformat()
    if not patch:
        return t

    start = patch.get("start_date", t["start_date"])
    end   = patch.get("end_date", t["end_date"])
    if str(end) < str(start):
        raise HTTPException(status_code=400, detail="end_date is before start_date")

    updated = _one(
        _db().table("tournaments").update(patch).eq("id", tournament_id).execute()
    )
    return updated or t


@router.delete("/editor/tournaments/{tournament_id}", status_code=204)
def delete_tournament(tournament_id: str, user: dict = Depends(require_user)):
    """Only a draft can be deleted. Once a tournament has been reviewed
    or published, fans and Scout may already be pointing at it, so it
    gets unpublished rather than erased."""
    t = _owned_tournament(tournament_id, user)
    if t["status"] != "draft":
        raise HTTPException(
            status_code=409,
            detail="Only a draft can be deleted. Unpublish it instead.",
        )
    _db().table("tournaments").delete().eq("id", tournament_id).execute()
    return None


# ── clubs (global) ────────────────────────────────────────────────────

@router.get("/editor/clubs")
def search_clubs(q: str = Query(..., min_length=2), limit: int = 20,
                 user: dict = Depends(require_user)):
    """Search the global club list before creating a new one.

    The editor should always show this first. Clubs are global, so a
    duplicate "Mech Eng" splits one squad's history in two.
    """
    rows = _rows(
        _db().table("clubs").select("id, name, short_name, crest_url, institution")
        .ilike("name", f"%{q}%").limit(limit).execute()
    )
    return {"count": len(rows), "clubs": rows}


def _find_or_create_club(body: TeamIn, user: dict) -> str:
    if body.club_id:
        club = _one(_db().table("clubs").select("id").eq("id", body.club_id).limit(1).execute())
        if not club:
            raise HTTPException(status_code=404, detail="club_id not found")
        return club["id"]

    if not body.club_name:
        raise HTTPException(status_code=400, detail="Provide either club_id or club_name")

    # Match on normalised name within the same institution, so "Mech Eng"
    # and "mech-eng" at ABU are one club, while two universities can both
    # have a Mechanical Engineering side.
    target = _norm_name(body.club_name)
    candidates = _rows(
        _db().table("clubs").select("id, name, institution")
        .ilike("name", f"%{body.club_name.strip()[:40]}%").limit(50).execute()
    )
    for c in candidates:
        if _norm_name(c["name"]) == target and (
            (c.get("institution") or "") == (body.institution or "")
        ):
            return c["id"]

    created = _one(_db().table("clubs").insert({
        "name":        body.club_name.strip(),
        "short_name":  body.short_name,
        "crest_url":   body.crest_url,
        "institution": body.institution,
        "created_by":  user["id"],
    }).execute())
    if not created:
        raise HTTPException(status_code=500, detail="Could not create the club")
    return created["id"]


# ── teams in a tournament ─────────────────────────────────────────────

@router.post("/editor/tournaments/{tournament_id}/teams", status_code=201)
def add_team(tournament_id: str, body: TeamIn, user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user)
    _require_editable(t)

    club_id = _find_or_create_club(body, user)

    existing = _one(
        _db().table("tournament_teams").select("id")
        .eq("tournament_id", tournament_id).eq("club_id", club_id)
        .limit(1).execute()
    )
    if existing:
        raise HTTPException(status_code=409, detail="That club is already in this tournament")

    created = _one(_db().table("tournament_teams").insert({
        "tournament_id": tournament_id,
        "club_id":       club_id,
        "group_name":    body.group_name,
        "home_color":    body.home_color,
        "away_color":    body.away_color,
    }).execute())
    return created


@router.delete("/editor/tournaments/{tournament_id}/teams/{team_id}", status_code=204)
def remove_team(tournament_id: str, team_id: str, user: dict = Depends(require_user)):
    """Removing a team cascades to its player registrations, so it is
    refused once fixtures exist -- a fixture references the team row and
    would be orphaned, and a played result must not vanish."""
    t = _owned_tournament(tournament_id, user)
    _require_editable(t)

    played = _rows(
        _db().table("fixtures").select("id")
        .eq("tournament_id", tournament_id)
        .or_(f"home_team_id.eq.{team_id},away_team_id.eq.{team_id}")
        .limit(1).execute()
    )
    if played:
        raise HTTPException(
            status_code=409,
            detail="This team already has fixtures. Delete those first.",
        )

    _db().table("tournament_teams").delete() \
        .eq("id", team_id).eq("tournament_id", tournament_id).execute()
    return None


# ── players ───────────────────────────────────────────────────────────

@router.get("/editor/players")
def search_players(q: str = Query(..., min_length=2), limit: int = 20,
                   user: dict = Depends(require_user)):
    """Search the global player list. Same reason as clubs: registering
    a new row for someone who already exists resets their career."""
    rows = _rows(
        _db().table("players").select("id, first_name, last_name, dob, position, photo_url")
        .or_(f"first_name.ilike.%{q}%,last_name.ilike.%{q}%")
        .limit(limit).execute()
    )
    return {"count": len(rows), "players": rows}


@router.post("/editor/teams/{team_id}/players", status_code=201)
def register_player(team_id: str, body: PlayerIn, user: dict = Depends(require_user)):
    """Register a player to a team in a tournament.

    team_id is a tournament_teams row, not a club. The tournament is
    resolved from it so ownership is still checked, rather than trusting
    a tournament id the client sends alongside.
    """
    team = _one(
        _db().table("tournament_teams").select("id, tournament_id")
        .eq("id", team_id).limit(1).execute()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    t = _owned_tournament(team["tournament_id"], user)
    _require_editable(t)

    if body.player_id:
        player = _one(
            _db().table("players").select("id").eq("id", body.player_id).limit(1).execute()
        )
        if not player:
            raise HTTPException(status_code=404, detail="player_id not found")
        player_id = player["id"]
    else:
        if not (body.first_name and body.last_name and body.dob):
            raise HTTPException(
                status_code=400,
                detail="A new player needs first_name, last_name and dob.",
            )
        # Same person, same birthday -> same global player. Without this
        # check the same student gets a fresh record every tournament and
        # never accumulates a career.
        same_day = _rows(
            _db().table("players").select("id, first_name, last_name")
            .eq("dob", body.dob.isoformat()).limit(200).execute()
        )
        player_id = None
        for p in same_day:
            if (_norm_name(p["first_name"]) == _norm_name(body.first_name)
                    and _norm_name(p["last_name"]) == _norm_name(body.last_name)):
                player_id = p["id"]
                break
        if player_id is None:
            created = _one(_db().table("players").insert({
                "first_name":  body.first_name.strip(),
                "last_name":   body.last_name.strip(),
                "dob":         body.dob.isoformat(),
                "position":    body.position,
                "photo_url":   body.photo_url,
                "nationality": body.nationality or "Nigeria",
                "created_by":  user["id"],
            }).execute())
            if not created:
                raise HTTPException(status_code=500, detail="Could not create the player")
            player_id = created["id"]

    already = _one(
        _db().table("player_registrations").select("id")
        .eq("player_id", player_id).eq("tournament_team_id", team_id)
        .limit(1).execute()
    )
    if already:
        raise HTTPException(status_code=409, detail="Player is already registered to this team")

    # A shirt number has to be unique within the squad, and the database
    # doesn't enforce that, so it's checked here.
    if body.jersey_number is not None:
        clash = _one(
            _db().table("player_registrations").select("id")
            .eq("tournament_team_id", team_id)
            .eq("jersey_number", body.jersey_number)
            .limit(1).execute()
        )
        if clash:
            raise HTTPException(
                status_code=409,
                detail=f"Shirt number {body.jersey_number} is already taken in this squad",
            )

    created = _one(_db().table("player_registrations").insert({
        "player_id":          player_id,
        "tournament_team_id": team_id,
        "jersey_number":      body.jersey_number,
        "position":           body.position,
    }).execute())
    return created


@router.get("/editor/teams/{team_id}/players")
def list_squad(team_id: str, user: dict = Depends(require_user)):
    team = _one(
        _db().table("tournament_teams").select("id, tournament_id")
        .eq("id", team_id).limit(1).execute()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    _owned_tournament(team["tournament_id"], user)

    rows = _rows(
        _db().table("player_registrations")
        .select("*, players(id, first_name, last_name, dob, position, photo_url)")
        .eq("tournament_team_id", team_id).execute()
    )
    return {"count": len(rows), "squad": rows}


@router.delete("/editor/teams/{team_id}/players/{registration_id}", status_code=204)
def unregister_player(team_id: str, registration_id: str,
                      user: dict = Depends(require_user)):
    team = _one(
        _db().table("tournament_teams").select("id, tournament_id")
        .eq("id", team_id).limit(1).execute()
    )
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    t = _owned_tournament(team["tournament_id"], user)
    _require_editable(t)

    _db().table("player_registrations").delete() \
        .eq("id", registration_id).eq("tournament_team_id", team_id).execute()
    return None
