"""
app/supabase.py — Supabase config and the admin client.

Two keys, two very different jobs:

  SUPABASE_SERVICE_ROLE_KEY — bypasses Row Level Security. Every table
    in the Scout schema has RLS on with zero policies, so this is the
    only way the backend gets in. Never ship it to a frontend. It is
    full admin access to the database.

  SUPABASE_ANON_KEY — the public key the web and mobile apps already
    use. The backend needs it only as the `apikey` header when asking
    the Auth server to validate a token (see app/deps.py). Safe to
    expose, it's in your frontend bundle anyway.

Authorisation is this backend's job, not Postgres's, because the
service role key skips RLS entirely. Check ownership in the route.
"""
import os
from functools import lru_cache

from supabase import Client, create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Auth server endpoints, derived so there's one source of truth.
AUTH_BASE = f"{SUPABASE_URL}/auth/v1"
JWKS_URL = f"{AUTH_BASE}/.well-known/jwks.json"
USER_URL = f"{AUTH_BASE}/user"
JWT_ISSUER = AUTH_BASE
JWT_AUDIENCE = "authenticated"


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Cached admin client. One instance per process so we're not
    rebuilding an HTTP session on every request."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. "
            "Add them under Render > Environment, and to your local .env."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
