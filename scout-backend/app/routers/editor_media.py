"""
app/routers/editor_media.py

Club crests, player photos, competition logos, and generated match
graphics (Pre-Match Probability/ATK-DEF cards & Full-Time score cards).
"""
import os
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.deps import require_user
from app.routers.editor import _db, _may_edit_club, _may_edit_player, _one, _rows

router = APIRouter()

BUCKET = os.environ.get("CREST_BUCKET", "club-crests")

# 1 MB for crests/headshots; 2.5 MB for 1080x1350 match graphics.
MAX_BYTES = 1_000_000
MAX_GRAPHIC_BYTES = 2_500_000

ALLOWED = {"png", "jpeg", "gif", "webp"}
EXT = {"png": "png", "jpeg": "jpg", "gif": "gif", "webp": "webp"}


def _sniff(data: bytes) -> str | None:
    if len(data) < 12:
        return None
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _validated(data: bytes, limit: int = MAX_BYTES) -> str:
    if not data:
        raise HTTPException(status_code=400, detail="That file is empty")
    if len(data) > limit:
        raise HTTPException(
            status_code=413,
            detail=f"Image must be under {limit // 1000} KB. That one is "
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
    try:
        _db().storage.create_bucket(
            BUCKET, options={"public": True, "file_size_limit": MAX_GRAPHIC_BYTES}
        )
    except Exception:
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
    """Clear a club's crest."""
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
    """The competition's own logo."""
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
    """Clear the logo."""
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


# ── match graphics (pre-match & full-time cards) ─────────────────────

@router.get("/editor/fixtures/{fixture_id}/prediction")
def editor_fixture_prediction(fixture_id: str, user: dict = Depends(require_user)):
    """Compute pre-match win probabilities and ATK/DEF ratings for any fixture
    in the editor so the graphic studio can render them before or after kickoff."""
    from app.routers.editor import _owned_tournament
    from app.routers.tournaments_public import _team_lookup, _local_prediction

    fx = _one(_db().table("fixtures").select("*").eq("id", fixture_id).limit(1).execute())
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found")

    tid = fx["tournament_id"]
    _owned_tournament(tid, user, need="editor")

    teams = _team_lookup(tid)
    all_fixtures = _rows(
        _db().table("fixtures")
        .select("id, status, home_team_id, away_team_id, home_score, away_score")
        .eq("tournament_id", tid)
        .execute()
    )
    prediction = _local_prediction(fx, teams, all_fixtures)
    return {
        "fixture_id": fixture_id,
        "prediction": prediction,
    }


@router.post("/editor/fixtures/{fixture_id}/graphic", status_code=201)
async def save_fixture_graphic(
    fixture_id: str,
    kind: str = Form(...),
    file: UploadFile = File(...),
    user: dict = Depends(require_user),
):
    """Upload a generated match graphic (prematch | ft) to Supabase Storage,
    log it in generated_images, and deduct 1 image from the user's quota."""
    from app.routers.editor import _owned_tournament
    from app.routers.billing import _subscription, _remaining

    if kind not in {"prematch", "ft"}:
        raise HTTPException(status_code=400, detail="kind must be 'prematch' or 'ft'")

    fx = _one(_db().table("fixtures").select("id, tournament_id").eq("id", fixture_id).limit(1).execute())
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found")

    _owned_tournament(fx["tournament_id"], user, need="editor")

    sub = _subscription(user["id"])
    remaining = _remaining(sub)
    if remaining is not None and remaining <= 0:
        raise HTTPException(
            status_code=402,
            detail=(
                f"You've used all {sub.get('image_quota')} images on the "
                f"{sub['plan']} plan. Upgrade in Settings to generate more."
            ),
        )

    data = await file.read()
    fmt = _validated(data, limit=MAX_GRAPHIC_BYTES)
    _ensure_bucket()

    path = f"graphics/{fixture_id}/{kind}_{uuid.uuid4().hex}.{EXT[fmt]}"
    try:
        _db().storage.from_(BUCKET).upload(
            path, data, {"content-type": f"image/{fmt}", "upsert": "false"}
        )
        public_url = _db().storage.from_(BUCKET).get_public_url(path)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Could not store graphic ({type(e).__name__}). Check '{BUCKET}' bucket is public.",
        )

    created = _one(_db().table("generated_images").insert({
        "user_id":    user["id"],
        "fixture_id": fixture_id,
        "kind":       kind,
        "image_url":  public_url,
    }).execute())

    if remaining is not None:
        _db().table("subscriptions").update({
            "images_used": (sub.get("images_used") or 0) + 1
        }).eq("id", sub["id"]).execute()

    after = _remaining(_subscription(user["id"]))
    return {
        "image": created,
        "image_url": public_url,
        "kind": kind,
        "remaining": after,
        "unlimited": after is None,
    }