"""
app/routers/editor_media.py

Club crests and player photos. Uploaded to Supabase Storage through
this backend rather than straight from the browser, for the same reason
everything else goes through here: Storage policies are not set up, the
service role key is what has write access, and that key must never reach
a client.

The bucket must exist and be PUBLIC, because a crest is rendered by an
<img> tag in Scout, the editor, and anywhere a fixture is shown. Create
it once in the Supabase dashboard (Storage > New bucket > name
"club-crests", Public on), or let ensure_bucket() below make it on
first upload. Club files use `{club_id}/...`; player photos use
`players/{player_id}/...`.

Crests are small on purpose. A 2 MB PNG of a department badge costs a
student on mobile data every single time a fixture list renders.
"""
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.deps import require_user
from app.routers.editor import _db, _may_edit_club, _may_edit_player, _one

router = APIRouter()

BUCKET = os.environ.get("CREST_BUCKET", "club-crests")

# 1 MB. Crests and headshots render small in most places; anything
# bigger is being paid for by the viewer and seen by nobody.
MAX_BYTES = 1_000_000

# Checked by sniffing the actual bytes, not by trusting the filename or
# the content-type header, both of which the client controls.
ALLOWED = {"png", "jpeg", "gif", "webp"}
EXT = {"png": "png", "jpeg": "jpg", "gif": "gif", "webp": "webp"}


def _sniff(data: bytes) -> str | None:
    """What this file actually is, from its magic bytes.

    Hand-rolled rather than imghdr, which was removed from the standard
    library in Python 3.13. It was imported at module level, so on 3.13
    this module failed to import and took the whole app down at boot,
    not just crest upload.

    Only the four formats in ALLOWED are detected. Anything else is
    None and gets the same rejection as a text file, which is what we
    want: a BMP or an SVG is not something to serve as a crest either.

    The JPEG test is the FF D8 FF start-of-image marker rather than
    imghdr's JFIF/Exif check, which rejected valid JPEGs from encoders
    that write neither. A phone photo with its Exif stripped is a real
    case and used to fail.
    """
    if len(data) < 12:
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    # RIFF....WEBP. The four length bytes in between are not fixed, and
    # checking only "RIFF" would let a WAV through as an image.
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _validated(data: bytes) -> str:
    """Size- and type-check an upload, or raise with a usable message."""
    if not data:
        raise HTTPException(status_code=400, detail="That file is empty")
    if len(data) > MAX_BYTES:
        raise HTTPException(
            status_code=413,
            # Rounded up, so a file one byte over doesn't report the
            # same number as the limit it just broke.
            detail=f"Image must be under {MAX_BYTES // 1000} KB. That one is "
                   f"{-(-len(data) // 1000)} KB.",
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


@router.post("/editor/players/{player_id}/photo")
async def upload_player_photo(
    player_id: str,
    file: UploadFile = File(...),
    user: dict = Depends(require_user),
):
    """Attach a headshot to a global player in Supabase Storage."""
    player = _one(
        _db().table("players")
        .select("id, first_name, last_name, photo_url, created_by")
        .eq("id", player_id).limit(1).execute()
    )
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if not _may_edit_player(player, user):
        raise HTTPException(
            status_code=403,
            detail="You can only change a player photo if you created the player or own one of their tournaments.",
        )

    data = await file.read()
    kind = _validated(data)
    _ensure_bucket()
    path = f"players/{player_id}/{uuid.uuid4().hex}.{EXT[kind]}"
    try:
        _db().storage.from_(BUCKET).upload(
            path, data, {"content-type": f"image/{kind}", "upsert": "false"}
        )
        public_url = _db().storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not store player photo ({type(e).__name__}). Check '{BUCKET}' bucket is public.",
        )

    updated = _one(
        _db().table("players").update({"photo_url": public_url})
        .eq("id", player_id).execute()
    )
    return {"player": updated, "photo_url": public_url}
