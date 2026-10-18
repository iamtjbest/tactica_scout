"""
app/supabase.py — one Supabase client for the whole backend.

Uses the SERVICE ROLE key, which bypasses Row Level Security. Every
table in the Scout schema has RLS enabled with zero policies, so this
key is the only way in. Two consequences:

  1. Never ship this key to a frontend. It is full admin access to the
     database. It belongs in Render's environment and nowhere else.
  2. Authorisation is THIS backend's job, not Postgres's. Check
     ownership in the route (see app/deps.py) before you read or write
     anything that belongs to a user.

If a client ever needs to hit Supabase directly (realtime live scores,
say), that's the point where we add real RLS policies keyed to the
Firebase JWT and the client uses the anon key instead. Not before.
"""
import os
from functools import lru_cache

from supabase import Client, create_client

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Cached client. lru_cache keeps one instance per process so we're
    not rebuilding an HTTP session on every request."""
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set. "
            "Add them under Render > Environment, and to your local .env."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
