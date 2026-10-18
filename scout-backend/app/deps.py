"""
app/deps.py — verify a Supabase access token, load the caller's profile.

The whole auth flow, for reference:

  1. Frontend signs up / signs in with @supabase/supabase-js using the
     ANON key. Supabase creates the row in auth.users and emails the
     6-digit code through our SMTP provider.
  2. Frontend calls verifyOtp() and ends up holding an access token
     (a JWT) plus a refresh token. The SDK refreshes on its own.
  3. Frontend sends that JWT to us: Authorization: Bearer <jwt>
  4. We verify the signature and read `sub`, which is the auth.users id.
  5. We load public.profiles for that id. A database trigger created
     that row the moment the account was created, so it always exists.

This backend never sends an email, never sees a password, and never
issues a token. Supabase Auth owns all of that.

On verification: Supabase strongly recommends against verifying with
the legacy shared HS256 secret and wants asymmetric keys checked
against the JWKS endpoint instead. But that endpoint returns no keys
while a project is still on legacy keys. So we detect which mode the
project is in, cache that for 10 minutes, and take the right path.
Flip the project to asymmetric keys and this starts using JWKS within
10 minutes with no redeploy.

    require_user   -> 401 unless a valid token is present
    require_admin  -> 401 unless valid, 403 unless profiles.role='admin'
    optional_user  -> the profile or None, never raises
"""
import time

import jwt
import requests
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient

from app.supabase import (
    JWKS_URL,
    JWT_AUDIENCE,
    JWT_ISSUER,
    SUPABASE_ANON_KEY,
    USER_URL,
    get_supabase,
)

JWKS_RECHECK_SECONDS = 600  # Supabase's edge caches JWKS for 10 min too.

_jwks_has_keys: bool | None = None
_jwks_checked_at: float = 0.0
_jwk_client: PyJWKClient | None = None


# ── which signing mode is this project on? ──────────────────────────────────
def _uses_asymmetric_keys() -> bool:
    """True if jwks.json publishes keys. Cached, because this is on the
    path of every single request."""
    global _jwks_has_keys, _jwks_checked_at
    now = time.time()
    if _jwks_has_keys is not None and (now - _jwks_checked_at) < JWKS_RECHECK_SECONDS:
        return _jwks_has_keys
    try:
        r = requests.get(JWKS_URL, timeout=5)
        _jwks_has_keys = bool(r.ok and (r.json() or {}).get("keys"))
    except Exception:
        _jwks_has_keys = False  # fall back to asking the Auth server
    _jwks_checked_at = now
    return _jwks_has_keys


# ── path A: verify locally against the published public keys ────────────────
def _verify_via_jwks(token: str) -> dict:
    global _jwk_client
    if _jwk_client is None:
        _jwk_client = PyJWKClient(JWKS_URL, cache_keys=True, lifespan=JWKS_RECHECK_SECONDS)
    try:
        signing_key = _jwk_client.get_signing_key_from_jwt(token)
    except Exception:
        # Unknown kid: token is from another project, or forged.
        raise HTTPException(401, "Invalid token")
    try:
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired, refresh and retry")
    except jwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")


# ── path B: ask the Auth server (works on legacy HS256 projects) ────────────
def _verify_via_auth_server(token: str) -> dict:
    if not SUPABASE_ANON_KEY:
        raise HTTPException(
            500,
            "SUPABASE_ANON_KEY is not set, and this project is not using "
            "asymmetric JWT signing keys, so tokens cannot be verified.",
        )
    try:
        r = requests.get(
            USER_URL,
            headers={"apikey": SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"},
            timeout=8,
        )
    except requests.RequestException:
        raise HTTPException(503, "Auth server unreachable, try again")
    if r.status_code != 200:
        raise HTTPException(401, "Invalid or expired token")
    body = r.json() or {}
    if not body.get("id"):
        raise HTTPException(401, "Invalid token")
    # Normalise to the same shape the JWKS path returns.
    return {"sub": body["id"], "email": body.get("email"), "role": body.get("role")}


def _decode_token(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "Empty bearer token")
    if _uses_asymmetric_keys():
        return _verify_via_jwks(token)
    return _verify_via_auth_server(token)


# ── claims -> our profile row ───────────────────────────────────────────────
def _load_profile(claims: dict) -> dict:
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(401, "Token carries no subject")

    sb = get_supabase()
    found = sb.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    if found.data:
        return found.data[0]

    # The on_auth_user_created trigger should have made this row when the
    # account was created. Getting here means the trigger is missing or
    # was added after this account existed. Heal it rather than 500.
    created = (
        sb.table("profiles")
        .upsert({"id": user_id, "email": claims.get("email")}, on_conflict="id")
        .execute()
    )
    if created.data:
        return created.data[0]
    raise HTTPException(500, "No profile for this account")


# ── the dependencies ────────────────────────────────────────────────────────
def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Valid Supabase token required. Returns the profiles row."""
    return _load_profile(_decode_token(authorization))


def require_admin(user: dict = Depends(require_user)) -> dict:
    """Valid token AND profiles.role = 'admin'. For tournament review."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    """For endpoints that work signed out but show more when signed in.
    Never raises on a bad token, just treats the caller as anonymous."""
    if not authorization:
        return None
    try:
        return _load_profile(_decode_token(authorization))
    except HTTPException:
        return None


# ── shared serialiser ───────────────────────────────────────────────────────
def public_user(u: dict) -> dict:
    """What we're willing to send to a client."""
    return {
        "id": u.get("id"),
        "email": u.get("email"),
        "display_name": u.get("display_name"),
        "role": u.get("role", "user"),
        "followed_teams": u.get("followed_teams") or [],
        "language": u.get("language") or "en",
    }
