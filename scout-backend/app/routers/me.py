"""
app/routers/me.py — the current user's own record.

Replaces the old app/routers/auth.py, which kept users in a JSON file
on disk. That could never work on Render: the filesystem is ephemeral,
so every deploy and every spin-down wiped the accounts.

Signup, login, email verification and password reset all happen in
Supabase Auth, called from the frontend. Nothing here.

    GET  /api/auth/me             -> {user}
    POST /api/me/followed-teams   -> {user}
    POST /api/me/settings         -> {user}

Paths are unchanged from the old router on purpose, so the frontends
only have to change how they get a token, not every call site.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.deps import public_user, require_user
from app.supabase import get_supabase

router = APIRouter()

MAX_FOLLOWED_TEAMS = 50
SUPPORTED_LANGUAGES = {"en", "fr", "ar", "pt", "es"}


class FollowedTeamsBody(BaseModel):
    teams: list[str] = Field(default_factory=list)


class SettingsBody(BaseModel):
    language: str


def _update_self(user: dict, patch: dict) -> dict:
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .update(patch)
        .eq("id", user["id"])          # scoped to the caller's own row
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "Update failed")
    return res.data[0]


@router.get("/auth/me")
def me(user: dict = Depends(require_user)):
    """Verifies the token and returns the caller's profile. The frontend
    can treat a 200 here as 'session is good'."""
    return {"user": public_user(user)}


@router.post("/me/followed-teams")
def update_followed_teams(
    body: FollowedTeamsBody,
    user: dict = Depends(require_user),
):
    teams = [t.strip() for t in body.teams if t and t.strip()]
    if len(teams) > MAX_FOLLOWED_TEAMS:
        raise HTTPException(400, f"Too many teams (max {MAX_FOLLOWED_TEAMS})")
    # De-duplicate, keep the order the user gave.
    seen: set[str] = set()
    deduped = [t for t in teams if not (t.lower() in seen or seen.add(t.lower()))]
    return {"user": public_user(_update_self(user, {"followed_teams": deduped}))}


@router.post("/me/settings")
def update_settings(body: SettingsBody, user: dict = Depends(require_user)):
    lang = body.language.strip().lower()
    if lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            400, f"Unsupported language. One of: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
        )
    return {"user": public_user(_update_self(user, {"language": lang}))}
