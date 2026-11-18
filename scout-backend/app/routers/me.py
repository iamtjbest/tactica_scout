"""
app/routers/me.py — the current user's own record & push token sync.
"""
from fastapi import APIRouter, Depends, Header, HTTPException
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


class PushTokenBody(BaseModel):
    expo_push_token: str
    platform: str = "android"
    followed_teams: list[str] | None = None
    followed_matches: list[str] | None = None


def _update_self(user: dict, patch: dict) -> dict:
    sb = get_supabase()
    res = (
        sb.table("profiles")
        .update(patch)
        .eq("id", user["id"])
        .execute()
    )
    if not res.data:
        raise HTTPException(500, "Update failed")
    return res.data[0]


def _optional_user(authorization: str | None) -> dict | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        return None
    try:
        sb = get_supabase()
        auth_res = sb.auth.get_user(token)
        uid = getattr(getattr(auth_res, "user", None), "id", None)
        if not uid:
            return None
        prof = sb.table("profiles").select("*").eq("id", uid).limit(1).execute()
        return prof.data[0] if prof.data else None
    except Exception:
        return None


@router.get("/auth/me")
def me(user: dict = Depends(require_user)):
    return {"user": public_user(user)}


@router.post("/me/followed-teams")
def update_followed_teams(
    body: FollowedTeamsBody,
    user: dict = Depends(require_user),
):
    teams = [t.strip() for t in body.teams if t and t.strip()]
    if len(teams) > MAX_FOLLOWED_TEAMS:
        raise HTTPException(400, f"Too many teams (max {MAX_FOLLOWED_TEAMS})")
    seen: set[str] = set()
    deduped = [t for t in teams if not (t.lower() in seen or seen.add(t.lower()))]

    updated = _update_self(user, {"followed_teams": deduped})
    get_supabase().table("device_push_tokens").update(
        {"followed_teams": deduped}
    ).eq("user_id", user["id"]).execute()

    return {"user": public_user(updated)}


@router.post("/me/settings")
def update_settings(body: SettingsBody, user: dict = Depends(require_user)):
    lang = body.language.strip().lower()
    if lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            400, f"Unsupported language. One of: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
        )
    return {"user": public_user(_update_self(user, {"language": lang}))}


@router.post("/me/push-token")
def register_push_token(
    body: PushTokenBody,
    authorization: str | None = Header(default=None),
):
    token = body.expo_push_token.strip()
    if not token:
        raise HTTPException(400, "expo_push_token is required")

    sb = get_supabase()
    caller = _optional_user(authorization)

    row: dict = {
        "expo_push_token": token,
        "platform": body.platform or "android",
        "active": True,
    }
    if caller:
        row["user_id"] = caller["id"]
        row["followed_teams"] = caller.get("followed_teams") or []
    elif body.followed_teams is not None:
        row["followed_teams"] = body.followed_teams

    if body.followed_matches is not None:
        row["followed_matches"] = body.followed_matches

    sb.table("device_push_tokens").upsert(row, on_conflict="expo_push_token").execute()
    return {"registered": True}