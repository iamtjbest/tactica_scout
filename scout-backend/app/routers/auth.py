"""
Lightweight auth for Scout -- a single JSON file as the user store
(app/data/users.json), same pattern as featured_x_posts.json. No
database exists anywhere in this project, so rather than silently
reaching for one, this is a deliberately minimal starting point that's
honest about what it is: fine for one operator testing sign-in /
followed teams / language locally. NOT production-grade -- no rate
limiting, no password reset flow, tokens never expire, passwords are
hashed (PBKDF2, stdlib only) but there's no HTTPS enforcement here.
Swap this for a real auth provider or a database-backed user table
before this goes out to real users.

POST /api/auth/signup       {username, password}         -> {token, user}
POST /api/auth/login        {username, password}         -> {token, user}
GET  /api/auth/me           (Authorization: Bearer <tok>) -> {user}
POST /api/me/followed-teams {teams: [str]}  (auth) -> {user}
POST /api/me/settings       {language: str} (auth) -> {user}

"Followed teams" are free-text strings for v1, not validated against
BSD team ids -- there's no team-search endpoint built yet to validate
against. Good enough to ship the UI; swap for real team ids once
/api/teams/search (or similar) exists.
"""
import hashlib, json, os, secrets, time
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel

router = APIRouter()
USERS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "users.json")


def _load() -> dict:
    try:
        with open(USERS_PATH, encoding="utf-8") as f:
            data = json.load(f)
            data.setdefault("users", {})
            data.setdefault("tokens", {})
            return data
    except Exception:
        return {"users": {}, "tokens": {}}


def _save(data: dict):
    os.makedirs(os.path.dirname(USERS_PATH), exist_ok=True)
    with open(USERS_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _hash_password(password: str, salt: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100_000).hex()


class SignupBody(BaseModel):
    username: str
    password: str


class LoginBody(BaseModel):
    username: str
    password: str


class FollowedTeamsBody(BaseModel):
    teams: list[str]


class SettingsBody(BaseModel):
    language: str


def _public_user(u: dict) -> dict:
    return {
        "username":       u["username"],
        "followed_teams": u.get("followed_teams", []),
        "language":        u.get("language", "en"),
    }


def _issue_token(data: dict, username: str) -> str:
    token = secrets.token_hex(24)
    data["tokens"][token] = username
    return token


def _current_user(data: dict, authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")
    token    = authorization.split(" ", 1)[1]
    username = data["tokens"].get(token)
    if not username or username not in data["users"]:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return data["users"][username]


@router.post("/auth/signup")
def signup(body: SignupBody):
    if len(body.username) < 3 or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Username must be 3+ chars, password 6+ chars.")
    data = _load()
    if body.username in data["users"]:
        raise HTTPException(status_code=409, detail="That username is already taken.")
    salt = secrets.token_hex(16)
    data["users"][body.username] = {
        "username":       body.username,
        "salt":           salt,
        "password_hash":  _hash_password(body.password, salt),
        "followed_teams": [],
        "language":       "en",
        "created_at":     time.time(),
    }
    token = _issue_token(data, body.username)
    _save(data)
    return {"token": token, "user": _public_user(data["users"][body.username])}


@router.post("/auth/login")
def login(body: LoginBody):
    data = _load()
    user = data["users"].get(body.username)
    if not user or _hash_password(body.password, user["salt"]) != user["password_hash"]:
        raise HTTPException(status_code=401, detail="Wrong username or password.")
    token = _issue_token(data, body.username)
    _save(data)
    return {"token": token, "user": _public_user(user)}


@router.get("/auth/me")
def me(authorization: str | None = Header(default=None)):
    data = _load()
    user = _current_user(data, authorization)
    return {"user": _public_user(user)}


@router.post("/me/followed-teams")
def update_followed_teams(body: FollowedTeamsBody, authorization: str | None = Header(default=None)):
    data = _load()
    user = _current_user(data, authorization)
    user["followed_teams"] = body.teams
    _save(data)
    return {"user": _public_user(user)}


@router.post("/me/settings")
def update_settings(body: SettingsBody, authorization: str | None = Header(default=None)):
    data = _load()
    user = _current_user(data, authorization)
    user["language"] = body.language
    _save(data)
    return {"user": _public_user(user)}
