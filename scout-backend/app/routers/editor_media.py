"""
app/routers/editor_media.py

Club crests. Uploaded to Supabase Storage through this backend rather
than straight from the browser, for the same reason everything else
goes through here: Storage policies are not set up, the service role
key is what has write access, and that key must never reach a client.

The bucket must exist and be PUBLIC, because a crest is rendered by an
<img> tag in Scout, the editor, and anywhere a fixture is shown. Create
it once in the Supabase dashboard (Storage > New bucket > name
"club-crests", Public on), or let ensure_bucket() below make it on
first upload.

Crests are small on purpose. A 2 MB PNG of a department badge costs a
student on mobile data every single time a fixture list renders.
"""
import imghdr
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.access import RANK
from app.deps import require_user
from app.routers.editor import _db, _one, _rows

router = APIRouter()

BUCKET = os.environ.get("CREST_BUCKET", "club-crests")

# 1 MB. A crest renders at 16-40px in most places; anything bigger is
# being paid for by the viewer and seen by nobody.
MAX_BYTES = 1_000_000

# Checked by sniffing the actual bytes, not by trusting the filename or
# the content-type header, both of which the client controls.
ALLOWED = {"png", "jpeg", "gif", "webp"}
EXT = {"png": "png", "jpeg": "jpg", "gif": "gif", "webp": "webp"}


def _sniff(data: bytes) -> str | None:
    """What this file actually is.

    imghdr reads magic bytes. webp predates imghdr's knowledge of it in
    some versions, so it's checked by hand: RIFF....WEBP.
    """
    kind = imghdr.what(None, h=data)
    if kind:
        return kind
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _validated(data: bytes) -> str:
    """Size- and type-check an upload, or raise with a usable message."""
    if not data:
        raise HTTPException(status_code=400, detail="That file is empty")
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image must be under {MAX_BYTES // 1000} KB. That one is "
                   f"{len(data) // 1000} KB.",
        )
    kind = _sniff(data)
    if kind not in ALLOWED:
        raise HTTPException(
            status_code=400,
            detail="That isn't an image we can use. PNG, JPG, GIF or WebP.",
        )
    return kind

def _ensure_bucket():
    """Create the bucket on first use so a fresh environment works
    without a manual step. Harmless if it already exists."""
    try:
        _db().storage.create_bucket(
            BUCKET, options={"public": True, "file_size_limit": MAX_BYTES}
        )
    except Exception:
        # Already exists, or the key can't create buckets. Either way the
        # upload below will tell us plainly if there's a real problem.
        pass


def _may_edit_club(club: dict, user: dict) -> bool:
    """May this user change this global club's crest?

    Clubs are shared across tournaments, so "whoever is signed in" is
    too loose: it would let any account replace any club's badge with
    anything. The rule is a connection to the club:

      - platform admin, or
      - they created the club, or
      - they own a tournament this club plays in.

    That keeps a genuinely shared club editable by the people actually
    running its competitions, and closed to everyone else.
    """
    if user.get("role") == "admin":
        return True
    if club.get("created_by") == user["id"]:
        return True

    entries = _rows(
        _db().table("tournament_teams").select("tournament_id")
        .eq("club_id", club["id"]).execute()
    )
    if not entries:
        return False
    tournament_ids = list({e["tournament_id"] for e in entries})

    mine = _rows(
        _db().table("tournament_members").select("tournament_id, role")
        .eq("user_id", user["id"]).in_("tournament_id", tournament_ids).execute()
    )
    return any(RANK.get(m["role"], 0) >= RANK["owner"] for m in mine)


@router.post("/editor/clubs/{club_id}/crest")
async def upload_crest(club_id: str, file: UploadFile = File(...),
                       user: dict = Depends(require_user)):
    """Attach a crest to a global club."""
    club = _one(_db().table("clubs").select("id, name, crest_url, created_by")
                .eq("id", club_id).limit(1).execute())
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    if not _may_edit_club(club, user):
        raise HTTPException(
            status_code=403,
            detail="You can only change the crest of a club in one of your tournaments.",
        )

    data = await file.read()
    kind = _validated(data)

    _ensure_bucket()

    # A fresh name every upload. Reusing the club id as the path means a
    # replaced crest keeps serving the old image from every CDN and
    # browser cache that already has it.
    path = f"{club_id}/{uuid.uuid4().hex}.{EXT[kind]}"
    try:
        _db().storage.from_(BUCKET).upload(
            path, data, {"content-type": f"image/{kind}", "upsert": "false"}
        )
        public_url = _db().storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not store the crest ({type(e).__name__}). Check the "
                   f"'{BUCKET}' bucket exists and is public.",
        )

    updated = _one(
        _db().table("clubs").update({"crest_url": public_url})
        .eq("id", club_id).execute()
    )
    return {"club": updated, "crest_url": public_url}


@router.delete("/editor/clubs/{club_id}/crest", status_code=200)
def remove_crest(club_id: str, user: dict = Depends(require_user)):
    """Clear a club's crest.

    The stored object is left in place deliberately: another club row
    could have been pointed at the same URL by hand, and an orphaned
    1 KB file is a much smaller problem than a crest that silently
    disappears from a published fixture list.
    """
    club = _one(_db().table("clubs").select("id, created_by")
                .eq("id", club_id).limit(1).execute())
    if not club:
        raise HTTPException(status_code=404, detail="Club not found")
    if not _may_edit_club(club, user):
        raise HTTPException(
            status_code=403,
            detail="You can only change the crest of a club in one of your tournaments.",
        )
    updated = _one(
        _db().table("clubs").update({"crest_url": None}).eq("id", club_id).execute()
    )
    return {"club": updated}

# ── competition logo ─────────────────────────────────────────────────

@router.post("/editor/tournaments/{tournament_id}/crest")
async def upload_tournament_crest(tournament_id: str, file: UploadFile = File(...),
                                  user: dict = Depends(require_user)):
    """The competition's own logo.

    Owner only, and gated on the same review freeze as everything else:
    the logo is part of what an admin looked at, so it cannot change
    while the decision is outstanding.
    """
    from app.routers.editor import _owned_tournament, _require_editable

    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)

    data = await file.read()
    kind = _validated(data)

    _ensure_bucket()
    path = f"tournaments/{tournament_id}/{uuid.uuid4().hex}.{EXT[kind]}"
    try:
        _db().storage.from_(BUCKET).upload(
            path, data, {"content-type": f"image/{kind}", "upsert": "false"}
        )
        public_url = _db().storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not store the logo ({type(e).__name__}). Check the "
                   f"'{BUCKET}' bucket exists and is public.",
        )

    updated = _one(
        _db().table("tournaments").update({"crest_url": public_url})
        .eq("id", tournament_id).execute()
    )
    return {"tournament": updated, "crest_url": public_url}


@router.delete("/editor/tournaments/{tournament_id}/crest", status_code=200)
def remove_tournament_crest(tournament_id: str, user: dict = Depends(require_user)):
    """Clear the logo. The stored object is left in place for the same
    reason a club's is: an orphaned file is a smaller problem than an
    image vanishing from a published competition."""
    from app.routers.editor import _owned_tournament, _require_editable

    t = _owned_tournament(tournament_id, user, need="owner")
    _require_editable(t)
    updated = _one(
        _db().table("tournaments").update({"crest_url": None})
        .eq("id", tournament_id).execute()
    )
    return {"tournament": updated}
