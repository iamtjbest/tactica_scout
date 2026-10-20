"""
app/access.py

Who may do what to a tournament.

Every editor endpoint goes through require_access(). It is the only
authorization in the system: RLS is enabled with no policies and this
backend holds the service role key, so Postgres will let this process
read or write any row it likes. Nothing except this function stops a
match commissioner on pitch 2 from deleting another organiser's teams.

Two roles, which is what running a tournament actually needs:

    editor  match details only: scoreline, goalscorers, assists,
            cards, substitutions. The match commissioner on pitch 2.
    owner   the tournament itself: teams, players, fixtures, proof,
            people, submitting. Plus everything an editor can do.

There was briefly a third tier between these. It was removed because
the split that exists in practice is "I run the tournament" and "you
run this match", and nothing sits between those.

A platform admin passes every check, which is what makes the review
queue work.
"""
from fastapi import HTTPException

from app.supabase import get_supabase

# Higher number wins. Comparing ranks beats a pile of `in` checks that
# each have to remember the full list.
RANK = {"editor": 1, "owner": 2}

FRIENDLY = {
    "editor": "update match details",
    "owner":  "manage this tournament",
}


def _db():
    return get_supabase()


def membership(tournament_id: str, user_id: str) -> str | None:
    """This user's role on this tournament, or None."""
    try:
        res = (
            _db().table("tournament_members").select("role")
            .eq("tournament_id", tournament_id).eq("user_id", user_id)
            .limit(1).execute()
        )
        rows = res.data or []
    except Exception as e:
        # A failed lookup must deny, never allow. If the members table
        # is unreachable we cannot prove anyone has access.
        print(f"[access] membership lookup failed: {e}")
        return None
    return rows[0]["role"] if rows else None


def require_access(tournament_id: str, user: dict, need: str = "owner") -> dict:
    """Load the tournament and prove this user may act at `need` level.

    404 when it doesn't exist, 403 when they're not on it or are
    ranked too low. Returns the tournament row with the caller's role
    attached as `_role`, so handlers can vary behaviour without a
    second query.
    """
    res = (
        _db().table("tournaments").select("*")
        .eq("id", tournament_id).limit(1).execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Tournament not found")
    t = rows[0]

    # Platform admins review every submission, so they pass everything.
    if user.get("role") == "admin":
        t["_role"] = "owner"
        return t

    role = membership(tournament_id, user["id"])

    # Belt and braces: owner_id is the source of truth for ownership,
    # and the members row is a mirror kept by a trigger. If the two
    # ever disagree, owner_id wins rather than locking an owner out of
    # their own tournament.
    if role is None and t.get("owner_id") == user["id"]:
        role = "owner"

    if role is None:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this tournament.",
        )
    if RANK.get(role, 0) < RANK.get(need, 99):
        raise HTTPException(
            status_code=403,
            detail=(
                f"Your role on this tournament is '{role}', which can't "
                f"{FRIENDLY.get(need, need)}."
            ),
        )

    t["_role"] = role
    return t
