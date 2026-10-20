"""
app/routers/billing.py

Image quota and payments.

The model TjBest set: hosting a tournament is free and unlimited. What
is paid for is AI-generated match graphics, the pre-match and FT cards
organisers share.

    free        10 images     NGN 0
    basic       25 images     NGN 5,000
    pro         50 images     NGN 10,000
    unlimited   no cap        NGN 25,000

MONEY RULES, because this file moves real naira:

1. The PRICE IS NEVER TAKEN FROM THE CLIENT. A request says which plan
   it wants; the amount comes from PLANS below. Trusting a client-sent
   amount is how someone buys `unlimited` for 1 kobo.
2. A plan is granted ONLY by a verified webhook or an explicit
   server-side verify call against Paystack. Returning from the
   checkout page is not proof of payment; the browser can be sent to a
   success URL by hand.
3. The webhook signature is HMAC-SHA512 of the RAW BODY, hex, compared
   in constant time against the x-paystack-signature header. It must
   hash the exact bytes received -- re-serialising the parsed JSON
   changes whitespace and the digest no longer matches.
4. Quota is decremented when an image is actually recorded, not when
   one is requested.

Set PAYSTACK_SECRET_KEY in the environment. Without it the checkout
endpoints refuse rather than pretending to work.
"""
import hashlib
import hmac
import os
import time
import uuid
from datetime import datetime, timezone

import requests as _requests
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.deps import require_user
from app.routers.editor import _db, _rows, _one

router = APIRouter()

PAYSTACK_SECRET_KEY = os.environ.get("PAYSTACK_SECRET_KEY", "")
PAYSTACK_BASE = "https://api.paystack.co"
APP_CALLBACK_URL = os.environ.get(
    "BILLING_CALLBACK_URL", "https://editor.tactica.com.ng/billing/callback"
)

# Amounts in KOBO: Paystack takes the minor unit, so NGN 5,000 is
# 500000. Getting this wrong by a factor of 100 is the classic bug, in
# both directions.
PLANS: dict[str, dict] = {
    "basic":     {"naira": 5_000,  "kobo": 500_000,   "images": 25,   "label": "25 images"},
    "pro":       {"naira": 10_000, "kobo": 1_000_000, "images": 50,   "label": "50 images"},
    "unlimited": {"naira": 25_000, "kobo": 2_500_000, "images": None, "label": "Unlimited images"},
}

FREE_QUOTA = 10


class CheckoutIn(BaseModel):
    # Deliberately no amount field. See money rule 1.
    plan: str = Field(description="basic | pro | unlimited")


class RecordImageIn(BaseModel):
    kind: str = Field(description="prematch | ft")
    image_url: str = Field(min_length=4, max_length=2000)
    fixture_id: str | None = None


# ── subscription state ────────────────────────────────────────────────

def _subscription(user_id: str) -> dict:
    """This user's active subscription, creating the free one on first
    look so every account has a row to count against."""
    sub = _one(
        _db().table("subscriptions").select("*")
        .eq("user_id", user_id).eq("active", True)
        .order("created_at", desc=True).limit(1).execute()
    )
    if sub:
        return sub
    created = _one(_db().table("subscriptions").insert({
        "user_id":     user_id,
        "plan":        "free",
        "image_quota": FREE_QUOTA,
        "images_used": 0,
    }).execute())
    if not created:
        raise HTTPException(status_code=500, detail="Could not start a free plan")
    return created


def _remaining(sub: dict) -> int | None:
    """None means unlimited. Not zero, and not a big number -- a caller
    that treats unlimited as a number will eventually hit the cap."""
    if sub["plan"] == "unlimited":
        return None
    return max(0, (sub.get("image_quota") or 0) - (sub.get("images_used") or 0))


@router.get("/billing/me")
def my_billing(user: dict = Depends(require_user)):
    sub = _subscription(user["id"])
    remaining = _remaining(sub)
    return {
        "plan":        sub["plan"],
        "image_quota": sub.get("image_quota"),
        "images_used": sub.get("images_used"),
        "remaining":   remaining,
        "unlimited":   remaining is None,
        "plans": [
            {"id": k, "naira": v["naira"], "images": v["images"], "label": v["label"]}
            for k, v in PLANS.items()
        ],
    }


# ── checkout ──────────────────────────────────────────────────────────

@router.post("/billing/checkout")
def start_checkout(body: CheckoutIn, user: dict = Depends(require_user)):
    """Create a Paystack transaction and hand back the URL to open.

    Nothing is granted here. The plan is applied when Paystack tells us
    the money arrived, either by webhook or by the verify endpoint
    below.
    """
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Payments aren't configured on the server (PAYSTACK_SECRET_KEY missing).",
        )
    plan = PLANS.get(body.plan)
    if not plan:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown plan. One of: {', '.join(PLANS)}",
        )
    email = user.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Your account has no email address")

    reference = f"tactica_{body.plan}_{user['id'][:8]}_{uuid.uuid4().hex[:10]}"

    try:
        resp = _requests.post(
            f"{PAYSTACK_BASE}/transaction/initialize",
            headers={
                "Authorization": f"Bearer {PAYSTACK_SECRET_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "email":        email,
                "amount":       plan["kobo"],
                "reference":    reference,
                "callback_url": APP_CALLBACK_URL,
                # Echoed back on the webhook, so the payment can be tied
                # to a user without trusting anything the client sends.
                "metadata": {
                    "user_id": user["id"],
                    "plan":    body.plan,
                },
            },
            timeout=20,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Paystack ({type(e).__name__})")

    if resp.status_code != 200:
        raise HTTPException(
            status_code=502,
            detail=f"Paystack rejected the request ({resp.status_code}).",
        )
    data = (resp.json() or {}).get("data") or {}
    if not data.get("authorization_url"):
        raise HTTPException(status_code=502, detail="Paystack returned no checkout URL")

    return {
        "authorization_url": data["authorization_url"],
        "reference":         reference,
        "plan":              body.plan,
        "amount_naira":      plan["naira"],
    }


def _grant(user_id: str, plan_key: str, reference: str) -> dict | None:
    """Apply a paid plan. Idempotent: if this reference was already
    used, nothing happens. Paystack retries webhooks, and a retry must
    not hand out a second allowance."""
    plan = PLANS.get(plan_key)
    if not plan:
        return None

    seen = _one(
        _db().table("subscriptions").select("id")
        .eq("paystack_ref", reference).limit(1).execute()
    )
    if seen:
        return seen

    # Close the old plan rather than editing it, so there's a history of
    # what someone paid for and when.
    _db().table("subscriptions").update({"active": False}) \
        .eq("user_id", user_id).eq("active", True).execute()

    return _one(_db().table("subscriptions").insert({
        "user_id":      user_id,
        "plan":         plan_key,
        # A nominal cap on unlimited so the column is never null; the
        # plan name is what actually decides, see _remaining().
        "image_quota":  plan["images"] if plan["images"] is not None else 1_000_000,
        "images_used":  0,
        "paystack_ref": reference,
        "period_start": datetime.now(timezone.utc).isoformat(),
        "active":       True,
    }).execute())


@router.post("/billing/webhook")
async def paystack_webhook(request: Request):
    """Paystack calls this when a payment completes.

    The signature is checked over the raw body before anything is read
    out of it. An unsigned or wrongly signed call is refused outright:
    this endpoint is public, so without that check anyone could post
    themselves a plan.
    """
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments aren't configured")

    raw = await request.body()
    signature = request.headers.get("x-paystack-signature", "")
    expected = hmac.new(
        PAYSTACK_SECRET_KEY.encode(), raw, hashlib.sha512
    ).hexdigest()
    if not signature or not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Bad signature")

    import json
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Body is not JSON")

    if payload.get("event") != "charge.success":
        # Other events are acknowledged so Paystack stops retrying.
        return {"ignored": payload.get("event")}

    data = payload.get("data") or {}
    meta = data.get("metadata") or {}
    reference = data.get("reference")
    user_id = meta.get("user_id")
    plan = meta.get("plan")

    if not (reference and user_id and plan):
        # Acknowledged, not applied. Raising here would make Paystack
        # retry forever on a payload we can never match to a user.
        print(f"[billing] charge.success missing metadata: ref={reference}")
        return {"ok": True, "applied": False, "reason": "missing metadata"}

    granted = _grant(user_id, plan, reference)
    return {"ok": True, "applied": bool(granted)}


@router.post("/billing/verify/{reference}")
def verify_payment(reference: str, user: dict = Depends(require_user)):
    """Ask Paystack directly whether a reference was paid.

    For the case where the user is back in the app before the webhook
    landed. Still checks with Paystack rather than believing the client,
    and grants through the same idempotent path as the webhook.
    """
    if not PAYSTACK_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Payments aren't configured")

    try:
        resp = _requests.get(
            f"{PAYSTACK_BASE}/transaction/verify/{reference}",
            headers={"Authorization": f"Bearer {PAYSTACK_SECRET_KEY}"},
            timeout=20,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Paystack ({type(e).__name__})")

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Paystack said {resp.status_code}")

    data = (resp.json() or {}).get("data") or {}
    if data.get("status") != "success":
        return {"paid": False, "status": data.get("status")}

    meta = data.get("metadata") or {}
    # The plan comes from Paystack's record of the transaction, not from
    # this request, and the user must match the one who started it.
    if meta.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="That payment belongs to another account")

    granted = _grant(user["id"], meta.get("plan"), reference)
    return {"paid": True, "applied": bool(granted), "plan": meta.get("plan")}


# ── image quota ───────────────────────────────────────────────────────

@router.get("/billing/can-generate")
def can_generate(user: dict = Depends(require_user)):
    """Checked before showing the generate button, so the UI can offer
    an upgrade instead of letting someone hit a wall."""
    sub = _subscription(user["id"])
    remaining = _remaining(sub)
    return {
        "allowed":   remaining is None or remaining > 0,
        "remaining": remaining,
        "unlimited": remaining is None,
        "plan":      sub["plan"],
    }


@router.post("/billing/images", status_code=201)
def record_image(body: RecordImageIn, user: dict = Depends(require_user)):
    """Record a generated image and spend one from the allowance.

    Called after the image exists, never before. Counting on request
    means a failed generation still costs someone an image, and that is
    the kind of thing people rightly complain about.
    """
    if body.kind not in {"prematch", "ft"}:
        raise HTTPException(status_code=400, detail="kind must be 'prematch' or 'ft'")

    sub = _subscription(user["id"])
    remaining = _remaining(sub)
    if remaining is not None and remaining <= 0:
        raise HTTPException(
            status_code=402,
            detail=(
                f"You've used all {sub.get('image_quota')} images on the "
                f"{sub['plan']} plan. Upgrade to generate more."
            ),
        )

    created = _one(_db().table("generated_images").insert({
        "user_id":    user["id"],
        "fixture_id": body.fixture_id,
        "kind":       body.kind,
        "image_url":  body.image_url,
    }).execute())

    if remaining is not None:
        # Read-modify-write. Two generations at the same instant could
        # in principle both read the same images_used; the cost is one
        # extra free image, which is a better failure than blocking a
        # paying organiser mid-matchday over a lock.
        _db().table("subscriptions").update({
            "images_used": (sub.get("images_used") or 0) + 1
        }).eq("id", sub["id"]).execute()

    after = _remaining(_subscription(user["id"]))
    return {"image": created, "remaining": after, "unlimited": after is None}


@router.get("/billing/images")
def my_images(limit: int = 50, user: dict = Depends(require_user)):
    rows = _rows(
        _db().table("generated_images").select("*")
        .eq("user_id", user["id"])
        .order("created_at", desc=True).limit(limit).execute()
    )
    return {"count": len(rows), "images": rows}
