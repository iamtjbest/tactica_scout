"""
app/routers/editor_review.py

Proof of legitimacy, submission, and admin review. This is the gate
between "an organiser typed a tournament into the app" and "fans see it
in Scout as a real competition".

The workflow mirrors Torneo's, which is the model TjBest specified:
  draft      organiser is still building it, nobody else can see it
  pending    submitted with proof, waiting on us
  approved   live, readable by Scout
  rejected   sent back with a reason, organiser can fix and resubmit
  unpublished  was live, pulled since

Submission is checked here rather than trusted from the client: a
tournament with no teams, no fixtures or no proof cannot be submitted,
because an empty one costs a reviewer's time to look at and reject.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.deps import require_user, require_admin
from app.routers.editor import _db, _rows, _one, _owned_tournament

router = APIRouter()

# Our own limits, from schema.sql: at least one link, or up to five
# files. Kept small deliberately -- student phones, Nigerian data costs.
MAX_PROOFS = 5
PROOF_TYPES = {"link", "document", "screenshot"}

MIN_TEAMS = 2


class ProofIn(BaseModel):
    type: str                       # link | document | screenshot
    url: str = Field(min_length=4, max_length=2000)
    note: str | None = Field(default=None, max_length=500)


class ReviewIn(BaseModel):
    approve: bool
    reason: str | None = Field(default=None, max_length=1000)


# ── proofs ────────────────────────────────────────────────────────────

@router.get("/editor/tournaments/{tournament_id}/proofs")
def list_proofs(tournament_id: str, user: dict = Depends(require_user)):
    _owned_tournament(tournament_id, user, need="owner")
    rows = _rows(
        _db().table("tournament_proofs").select("*")
        .eq("tournament_id", tournament_id).execute()
    )
    return {"count": len(rows), "proofs": rows}


@router.post("/editor/tournaments/{tournament_id}/proofs", status_code=201)
def add_proof(tournament_id: str, body: ProofIn, user: dict = Depends(require_user)):
    """Attach evidence the competition is real: a letter from the
    sports department, a fixture poster, the organising body's page."""
    t = _owned_tournament(tournament_id, user, need="owner")
    if t["status"] not in {"draft", "rejected"}:
        raise HTTPException(
            status_code=409,
            detail=f"Proof can't be added while the tournament is '{t['status']}'.",
        )
    if body.type not in PROOF_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"type must be one of: {', '.join(sorted(PROOF_TYPES))}",
        )

    existing = _rows(
        _db().table("tournament_proofs").select("id")
        .eq("tournament_id", tournament_id).execute()
    )
    if len(existing) >= MAX_PROOFS:
        raise HTTPException(
            status_code=409,
            detail=f"That's the limit of {MAX_PROOFS} proofs. Remove one first.",
        )

    created = _one(_db().table("tournament_proofs").insert({
        "tournament_id": tournament_id,
        "type":          body.type,
        "url":           body.url.strip(),
        "note":          body.note,
    }).execute())
    return created


@router.delete("/editor/tournaments/{tournament_id}/proofs/{proof_id}", status_code=204)
def delete_proof(tournament_id: str, proof_id: str, user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user)
    if t["status"] not in {"draft", "rejected"}:
        raise HTTPException(
            status_code=409,
            detail=f"Proof can't be removed while the tournament is '{t['status']}'.",
        )
    _db().table("tournament_proofs").delete() \
        .eq("id", proof_id).eq("tournament_id", tournament_id).execute()
    return None


# ── submission ────────────────────────────────────────────────────────

def _readiness(tournament_id: str) -> dict:
    """What's still missing before this can be submitted. Returned as a
    list so the editor can show a checklist rather than one error at a
    time, which is the difference between a two-minute fix and five
    round trips."""
    teams = _rows(
        _db().table("tournament_teams").select("id")
        .eq("tournament_id", tournament_id).execute()
    )
    fixtures = _rows(
        _db().table("fixtures").select("id")
        .eq("tournament_id", tournament_id).execute()
    )
    proofs = _rows(
        _db().table("tournament_proofs").select("id")
        .eq("tournament_id", tournament_id).execute()
    )

    missing = []
    if len(teams) < MIN_TEAMS:
        missing.append(f"at least {MIN_TEAMS} teams (currently {len(teams)})")
    if not fixtures:
        missing.append("a fixture list")
    if not proofs:
        missing.append("at least one proof of legitimacy")

    return {
        "ready":   not missing,
        "missing": missing,
        "counts":  {"teams": len(teams), "fixtures": len(fixtures), "proofs": len(proofs)},
    }


@router.get("/editor/tournaments/{tournament_id}/readiness")
def readiness(tournament_id: str, user: dict = Depends(require_user)):
    """Checklist for the submit button, so the UI can show what's left
    before the organiser taps it."""
    _owned_tournament(tournament_id, user, need="editor")
    return _readiness(tournament_id)


@router.post("/editor/tournaments/{tournament_id}/submit")
def submit_for_review(tournament_id: str, user: dict = Depends(require_user)):
    t = _owned_tournament(tournament_id, user)
    if t["status"] not in {"draft", "rejected"}:
        raise HTTPException(
            status_code=409,
            detail=f"Already '{t['status']}'. Only a draft or a rejected tournament can be submitted.",
        )

    state = _readiness(tournament_id)
    if not state["ready"]:
        raise HTTPException(
            status_code=400,
            detail="Not ready to submit. Still missing: " + "; ".join(state["missing"]),
        )

    updated = _one(_db().table("tournaments").update({
        "status":           "pending",
        "submitted_at":     datetime.now(timezone.utc).isoformat(),
        "rejection_reason": None,
    }).eq("id", tournament_id).execute())
    return updated


@router.post("/editor/tournaments/{tournament_id}/unpublish")
def unpublish(tournament_id: str, user: dict = Depends(require_user)):
    """Pull a live tournament from Scout. The organiser can do this to
    their own; it does not delete anything."""
    t = _owned_tournament(tournament_id, user)
    if t["status"] != "approved":
        raise HTTPException(status_code=409, detail="Only an approved tournament can be unpublished")
    return _one(_db().table("tournaments").update({"status": "unpublished"})
                .eq("id", tournament_id).execute())


# ── admin review ──────────────────────────────────────────────────────

@router.get("/editor/admin/review-queue")
def review_queue(status: str = Query(default="pending"),
                 admin: dict = Depends(require_admin)):
    """Everything waiting on a decision, oldest submission first, so the
    queue is fair rather than whatever Postgres returns."""
    rows = _rows(
        _db().table("tournaments").select("*")
        .eq("status", status)
        .order("submitted_at", desc=False)
        .execute()
    )
    out = []
    for t in rows:
        proofs = _rows(
            _db().table("tournament_proofs").select("*")
            .eq("tournament_id", t["id"]).execute()
        )
        out.append({**t, "proofs": proofs, "readiness": _readiness(t["id"])})
    return {"count": len(out), "tournaments": out}


@router.post("/editor/admin/tournaments/{tournament_id}/review")
def review(tournament_id: str, body: ReviewIn, admin: dict = Depends(require_admin)):
    """Approve or reject. Approving is what makes a tournament visible
    in Scout, so it is admin-only and never something a client can set
    by sending a status field.

    A rejection must carry a reason. "Rejected" with no explanation
    means the organiser resubmits the same thing and we both waste the
    round trip.
    """
    t = _one(_db().table("tournaments").select("*").eq("id", tournament_id).limit(1).execute())
    if not t:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if t["status"] != "pending":
        raise HTTPException(
            status_code=409,
            detail=f"Tournament is '{t['status']}', not pending review.",
        )

    if not body.approve and not (body.reason or "").strip():
        raise HTTPException(status_code=400, detail="A rejection needs a reason.")

    patch = {
        "status":           "approved" if body.approve else "rejected",
        "rejection_reason": None if body.approve else body.reason.strip(),
        "reviewed_at":      datetime.now(timezone.utc).isoformat(),
        "reviewed_by":      admin["id"],
    }
    return _one(_db().table("tournaments").update(patch).eq("id", tournament_id).execute())
