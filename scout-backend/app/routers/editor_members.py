"""
app/routers/editor_members.py

Letting other people work on a tournament.

Two routes in, because they suit different moments:

  INVITE CODE   the owner creates a code and hands it over. Instant,
                works when you're standing next to each other before
                kickoff, needs nothing from the owner afterwards. This
                is the common case at a university tournament.

  ACCESS REQUEST  someone finds the tournament and asks; the owner
                approves. For when you aren't in the same place. Note
                that only APPROVED tournaments are publicly findable,
                so this cannot be the only route: a commissioner
                can't request access to a draft.

Invites can never grant ownership, enforced by a database constraint
as well as here. Ownership moving because somebody forwarded a code
is not a failure mode worth having.
"""
import os
import secrets
from datetime import datetime, timezone

import requests as _requests
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.access import require_access, membership, RANK
from app.deps import require_user
from app.routers.editor import _db, _rows, _one

router = APIRouter()

# Unambiguous alphabet: no O/0, I/1/L. These get read out loud across a
# pitch, and "was that an O or a zero" is a support ticket.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
CODE_LEN = 8

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
MAIL_FROM = os.environ.get("MAIL_FROM", "Tactica <noreply@tactica.com.ng>")
# No default on purpose. The editor isn't deployed yet, so inventing a
# URL would put a dead link in an invite and in the owner's email. When
# this is unset the CODE still works -- it is typed into the app, which
# is how it gets used at a pitch anyway -- and join_url simply isn't
# offered. Set EDITOR_URL on Render once the domain is live.
EDITOR_URL = os.environ.get("EDITOR_URL", "").rstrip("/")


def _join_url(code: str) -> str | None:
    return f"{EDITOR_URL}/join?code={code}" if EDITOR_URL else None


class InviteIn(BaseModel):
    role: str = Field(default="editor", description="scorer | editor")
    expires_in_hours: int | None = Field(default=None, ge=1, le=24 * 30)
    max_uses: int | None = Field(default=None, ge=1, le=100)


class JoinIn(BaseModel):
    code: str = Field(min_length=4, max_length=32)


class RequestIn(BaseModel):
    message: str | None = Field(default=None, max_length=500)
    role_requested: str = Field(default="editor")


class DecideIn(BaseModel):
    approve: bool
    role: str | None = Field(default=None, description="override the requested role")


class RoleIn(BaseModel):
    role: str = Field(description="scorer | editor")


def _check_role(role: str):
    if role not in {"editor"}:
        raise HTTPException(
            status_code=400,
            detail="Role must be 'scorer' or 'editor'. Ownership can't be granted this way.",
        )


def _send_email(to: str, subject: str, html: str) -> bool:
    """Best effort. Email is a nudge, never the mechanism.

    Every request also shows up in the owner's in-app list, because a
    tournament must not stall on whether an email was delivered to
    someone standing in a field with one bar of signal.
    """
    if not RESEND_API_KEY or not to:
        return False
    try:
        r = _requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={"from": MAIL_FROM, "to": [to], "subject": subject, "html": html},
            timeout=10,
        )
        return r.status_code < 300
    except Exception as e:
        print(f"[members] email send failed: {e}")
        return False


def _profile(user_id: str) -> dict:
    return _one(
        _db().table("profiles").select("id, email, display_name")
        .eq("id", user_id).limit(1).execute()
    ) or {}


# ── members ───────────────────────────────────────────────────────────

@router.get("/editor/tournaments/{tournament_id}/members")
def list_members(tournament_id: str, user: dict = Depends(require_user)):
    """Anyone on the tournament can see who else is on it. A scorer
    should know who to hand a pitch over to."""
    require_access(tournament_id, user, need="editor")
    rows = _rows(
        _db().table("tournament_members")
        .select("*, profiles!tournament_members_user_id_fkey(id, email, display_name)")
        .eq("tournament_id", tournament_id).execute()
    )
    return {"count": len(rows), "members": rows}


@router.patch("/editor/tournaments/{tournament_id}/members/{member_id}")
def change_role(tournament_id: str, member_id: str, body: RoleIn,
                user: dict = Depends(require_user)):
    require_access(tournament_id, user, need="owner")
    _check_role(body.role)

    m = _one(
        _db().table("tournament_members").select("*")
        .eq("id", member_id).eq("tournament_id", tournament_id).limit(1).execute()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    if m["role"] == "owner":
        raise HTTPException(status_code=409, detail="The owner's role can't be changed here.")

    return _one(
        _db().table("tournament_members").update({"role": body.role})
        .eq("id", member_id).execute()
    )


@router.delete("/editor/tournaments/{tournament_id}/members/{member_id}", status_code=204)
def remove_member(tournament_id: str, member_id: str, user: dict = Depends(require_user)):
    """Revoke someone's access. Their match events stay: they are a
    record of what happened, and deleting the person must not rewrite
    the history of a match that was played."""
    require_access(tournament_id, user, need="owner")
    m = _one(
        _db().table("tournament_members").select("role")
        .eq("id", member_id).eq("tournament_id", tournament_id).limit(1).execute()
    )
    if not m:
        raise HTTPException(status_code=404, detail="Member not found")
    if m["role"] == "owner":
        raise HTTPException(status_code=409, detail="The owner can't be removed.")
    _db().table("tournament_members").delete().eq("id", member_id).execute()
    return None


# ── invite codes ──────────────────────────────────────────────────────

@router.post("/editor/tournaments/{tournament_id}/invites", status_code=201)
def create_invite(tournament_id: str, body: InviteIn,
                  user: dict = Depends(require_user)):
    t = require_access(tournament_id, user, need="owner")
    _check_role(body.role)

    expires = None
    if body.expires_in_hours:
        expires = datetime.fromtimestamp(
            datetime.now(timezone.utc).timestamp() + body.expires_in_hours * 3600,
            tz=timezone.utc,
        ).isoformat()

    code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LEN))

    created = _one(_db().table("tournament_invites").insert({
        "tournament_id": tournament_id,
        "code":          code,
        "role":          body.role,
        "created_by":    user["id"],
        "expires_at":    expires,
        "max_uses":      body.max_uses,
    }).execute())

    return {
        "invite": created,
        "code": code,
        "join_url": _join_url(code),
        "tournament_name": t["name"],
    }


@router.get("/editor/tournaments/{tournament_id}/invites")
def list_invites(tournament_id: str, user: dict = Depends(require_user)):
    require_access(tournament_id, user, need="owner")
    rows = _rows(
        _db().table("tournament_invites").select("*")
        .eq("tournament_id", tournament_id)
        .order("created_at", desc=True).execute()
    )
    for r in rows:
        r["join_url"] = _join_url(r["code"])
    return {"count": len(rows), "invites": rows}


@router.delete("/editor/tournaments/{tournament_id}/invites/{invite_id}", status_code=200)
def revoke_invite(tournament_id: str, invite_id: str, user: dict = Depends(require_user)):
    """Revoked, not deleted, so the row survives as a record of who
    created it and how many people used it."""
    require_access(tournament_id, user, need="owner")
    updated = _one(
        _db().table("tournament_invites").update({"revoked": True})
        .eq("id", invite_id).eq("tournament_id", tournament_id).execute()
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Invite not found")
    return {"revoked": True}


@router.post("/editor/join")
def join_with_code(body: JoinIn, user: dict = Depends(require_user)):
    """Redeem an invite code.

    Deliberately NOT under /tournaments/{id}: the person joining does
    not know the tournament id yet, and shouldn't need to. The code is
    the only thing they have.
    """
    code = body.code.strip().upper()
    inv = _one(
        _db().table("tournament_invites").select("*").eq("code", code).limit(1).execute()
    )
    # One message for every failure. Saying "that code expired" tells
    # someone guessing codes that they found a real one.
    bad = HTTPException(status_code=404, detail="That code isn't valid.")
    if not inv or inv.get("revoked"):
        raise bad
    if inv.get("expires_at") and inv["expires_at"] < datetime.now(timezone.utc).isoformat():
        raise bad
    if inv.get("max_uses") is not None and (inv.get("uses") or 0) >= inv["max_uses"]:
        raise bad

    t = _one(
        _db().table("tournaments").select("id, name")
        .eq("id", inv["tournament_id"]).limit(1).execute()
    )
    if not t:
        raise bad

    existing = membership(t["id"], user["id"])
    if existing:
        # Already on it. Never downgrade: an owner redeeming a scorer
        # code they forwarded must not demote themselves.
        return {
            "joined": True, "already": True,
            "tournament_id": t["id"], "tournament_name": t["name"], "role": existing,
        }

    _db().table("tournament_members").insert({
        "tournament_id": t["id"],
        "user_id":       user["id"],
        "role":          inv["role"],
        "invited_by":    inv["created_by"],
    }).execute()

    _db().table("tournament_invites").update({
        "uses": (inv.get("uses") or 0) + 1
    }).eq("id", inv["id"]).execute()

    return {
        "joined": True, "already": False,
        "tournament_id": t["id"], "tournament_name": t["name"], "role": inv["role"],
    }


# ── access requests ───────────────────────────────────────────────────

@router.post("/editor/tournaments/{tournament_id}/request-access", status_code=201)
def request_access(tournament_id: str, body: RequestIn,
                   user: dict = Depends(require_user)):
    """Ask the owner for access.

    No require_access here on purpose: the whole point is that this
    person has none yet. Only published tournaments can be requested,
    because a draft is not discoverable and shouldn't be probe-able by
    posting ids at this endpoint.
    """
    _check_role(body.role_requested)

    t = _one(
        _db().table("tournaments").select("id, name, owner_id, status")
        .eq("id", tournament_id).limit(1).execute()
    )
    if not t or t["status"] != "approved":
        raise HTTPException(status_code=404, detail="Tournament not found")

    if membership(tournament_id, user["id"]):
        raise HTTPException(status_code=409, detail="You already have access to this one.")

    existing = _one(
        _db().table("tournament_access_requests").select("*")
        .eq("tournament_id", tournament_id).eq("user_id", user["id"])
        .limit(1).execute()
    )
    if existing and existing["status"] == "pending":
        return {"requested": True, "already": True, "request": existing}

    row = {
        "tournament_id":  tournament_id,
        "user_id":        user["id"],
        "message":        body.message,
        "role_requested": body.role_requested,
        "status":         "pending",
        "decided_by":     None,
        "decided_at":     None,
    }
    if existing:
        # Re-asking after a rejection updates the one row, so nobody
        # can fill the owner's queue by requesting repeatedly.
        created = _one(
            _db().table("tournament_access_requests").update(row)
            .eq("id", existing["id"]).execute()
        )
    else:
        created = _one(_db().table("tournament_access_requests").insert(row).execute())

    me = _profile(user["id"])
    owner = _profile(t["owner_id"])
    emailed = _send_email(
        owner.get("email", ""),
        f"Someone wants to help run {t['name']}",
        f"""
        <p><strong>{me.get('display_name') or me.get('email') or 'Someone'}</strong>
        is asking for access to <strong>{t['name']}</strong>
        as a {body.role_requested}.</p>
        {f'<p>They said: {body.message}</p>' if body.message else ''}
        {f'<p>Approve or decline it here: <a href="{EDITOR_URL}/t/{tournament_id}?tab=access">{EDITOR_URL}</a></p>' if EDITOR_URL else '<p>Open the Tactica editor and go to the tournament&rsquo;s Access tab to approve or decline.</p>'}
        <p style="color:#8A9BA8;font-size:12px">
        You can also hand out an invite code from the Access tab, which is
        faster when you're together at the pitch.</p>
        """,
    )
    # emailed=false is fine and worth returning: the request is in the
    # owner's in-app list either way.
    return {"requested": True, "already": False, "request": created, "owner_emailed": emailed}


@router.get("/editor/tournaments/{tournament_id}/requests")
def list_requests(tournament_id: str, status: str = "pending",
                  user: dict = Depends(require_user)):
    require_access(tournament_id, user, need="owner")
    rows = _rows(
        _db().table("tournament_access_requests")
        .select("*, profiles!tournament_access_requests_user_id_fkey(id, email, display_name)")
        .eq("tournament_id", tournament_id).eq("status", status)
        .order("created_at").execute()
    )
    return {"count": len(rows), "requests": rows}


@router.post("/editor/tournaments/{tournament_id}/requests/{request_id}")
def decide_request(tournament_id: str, request_id: str, body: DecideIn,
                   user: dict = Depends(require_user)):
    t = require_access(tournament_id, user, need="owner")

    r = _one(
        _db().table("tournament_access_requests").select("*")
        .eq("id", request_id).eq("tournament_id", tournament_id).limit(1).execute()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Request not found")
    if r["status"] != "pending":
        raise HTTPException(status_code=409, detail=f"Already {r['status']}.")

    role = body.role or r["role_requested"]
    if body.approve:
        _check_role(role)
        if not membership(tournament_id, r["user_id"]):
            _db().table("tournament_members").insert({
                "tournament_id": tournament_id,
                "user_id":       r["user_id"],
                "role":          role,
                "invited_by":    user["id"],
            }).execute()

    updated = _one(
        _db().table("tournament_access_requests").update({
            "status":     "approved" if body.approve else "rejected",
            "decided_by": user["id"],
            "decided_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", request_id).execute()
    )

    asker = _profile(r["user_id"])
    _send_email(
        asker.get("email", ""),
        f"Your access request for {t['name']}",
        f"""<p>{'You now have access to' if body.approve else 'Your request for'}
        <strong>{t['name']}</strong>{'' if body.approve else ' was declined'}.</p>
        {f'<p>Open it: <a href="{EDITOR_URL}/t/{tournament_id}">{EDITOR_URL}</a></p>'
         if (body.approve and EDITOR_URL) else ''}""",
    )
    return {"request": updated, "granted_role": role if body.approve else None}


@router.get("/editor/my-requests")
def my_requests(user: dict = Depends(require_user)):
    """So someone who asked can see where it got to, rather than
    wondering whether the owner ever saw it."""
    rows = _rows(
        _db().table("tournament_access_requests")
        .select("*, tournaments(id, name)")
        .eq("user_id", user["id"])
        .order("created_at", desc=True).execute()
    )
    return {"count": len(rows), "requests": rows}
