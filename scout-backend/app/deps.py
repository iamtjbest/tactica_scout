"""
app/deps.py — Firebase ID-token verification and the app's user record.

The flow, end to end:

  1. The frontend signs in with the Firebase SDK (email/password,
     Google, whatever you enable) and receives an ID token.
  2. The frontend sends it on every call as:
         Authorization: Bearer <firebase_id_token>
  3. require_user() verifies that token's signature against Firebase.
  4. We look up (or create) the matching row in Supabase `users`, keyed
     on firebase_uid.

Firebase owns credentials. Supabase owns everything else about the
user: their role, followed teams, language. This backend never sees a
password, which is why /api/auth/signup and /api/auth/login no longer
exist. They were replaced by the Firebase SDK on the client.

Three dependencies to use in routes:
    require_user   -> 401 unless a valid token is present
    require_admin  -> 401 unless valid, 403 unless users.role = 'admin'
    optional_user  -> returns the user or None, never raises
"""
import json
import os

import firebase_admin
from fastapi import Depends, Header, HTTPException
from firebase_admin import auth as fb_auth
from firebase_admin import credentials

from app.supabase import get_supabase


# ── Firebase Admin init (once per process, lazily) ──────────────────────────
def _init_firebase() -> None:
    if firebase_admin._apps:
        return
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON", "")
    if not raw:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON is not set. Paste the whole "
            "service-account JSON as a single Render environment variable."
        )
    try:
        cred = credentials.Certificate(json.loads(raw))
    except json.JSONDecodeError as exc:
        raise RuntimeError(
            "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON. Paste the file "
            "contents verbatim, including the braces."
        ) from exc
    firebase_admin.initialize_app(cred)


# ── Token -> Firebase claims ────────────────────────────────────────────────
def _decode_token(authorization: str | None) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(401, "Empty bearer token")

    _init_firebase()
    try:
        # check_revoked catches tokens from a signed-out or disabled account.
        return fb_auth.verify_id_token(token, check_revoked=True)
    except fb_auth.ExpiredIdTokenError:
        raise HTTPException(401, "Token expired, refresh and retry")
    except fb_auth.RevokedIdTokenError:
        raise HTTPException(401, "Token revoked, sign in again")
    except fb_auth.UserDisabledError:
        raise HTTPException(403, "This account is disabled")
    except Exception:
        # Bad signature, wrong project, malformed token. Don't leak which.
        raise HTTPException(401, "Invalid token")


# ── Firebase claims -> our users row ────────────────────────────────────────
def _get_or_create_user(claims: dict) -> dict:
    sb = get_supabase()
    uid = claims.get("uid") or claims.get("user_id")
    if not uid:
        raise HTTPException(401, "Token carries no uid")

    found = sb.table("users").select("*").eq("firebase_uid", uid).limit(1).execute()
    if found.data:
        return found.data[0]

    # First time we've seen this Firebase account. Role always defaults to
    # 'user' in the schema. Admin is granted by hand in the Supabase table
    # editor, never by anything a client can send.
    new_row = {
        "firebase_uid": uid,
        "email": claims.get("email"),
        "display_name": claims.get("name") or claims.get("email"),
    }
    created = (
        sb.table("users")
        .upsert(new_row, on_conflict="firebase_uid")
        .execute()
    )
    if created.data:
        return created.data[0]

    # Upsert raced with a concurrent first request. Read it back.
    again = sb.table("users").select("*").eq("firebase_uid", uid).limit(1).execute()
    if again.data:
        return again.data[0]
    raise HTTPException(500, "Could not create user record")


# ── The dependencies ────────────────────────────────────────────────────────
def require_user(authorization: str | None = Header(default=None)) -> dict:
    """Valid Firebase token required. Returns the Supabase users row."""
    return _get_or_create_user(_decode_token(authorization))


def require_admin(user: dict = Depends(require_user)) -> dict:
    """Valid token AND users.role = 'admin'. For tournament review."""
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    return user


def optional_user(authorization: str | None = Header(default=None)) -> dict | None:
    """For endpoints that work signed out but show more when signed in.
    Never raises on a bad token, just treats the caller as anonymous."""
    if not authorization:
        return None
    try:
        return _get_or_create_user(_decode_token(authorization))
    except HTTPException:
        return None


# ── Shared serialiser ───────────────────────────────────────────────────────
def public_user(u: dict) -> dict:
    """What we're willing to send to a client. Note firebase_uid and the
    internal id stay server-side."""
    return {
        "email": u.get("email"),
        "display_name": u.get("display_name"),
        "role": u.get("role", "user"),
        "followed_teams": u.get("followed_teams") or [],
        "language": u.get("language") or "en",
    }
