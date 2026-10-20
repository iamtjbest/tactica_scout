"""
app/routers/admin.py

GET /api/admin/freeze-upcoming?hours=6&limit=4

Freezes the Tactica pre-match numbers for upcoming matches in Europe's
top 5 leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1),
so every one of those matches has real numbers saved before kickoff
whether or not anyone opened its Facts tab.

Meant to be hit on a schedule by an external pinger (cron-job.org etc,
every 30 minutes). Render's own cron is paid; this keeps it free.

Protected by the ADMIN_KEY env var, sent as header  X-Admin-Key.
Without ADMIN_KEY set on the server the endpoint refuses everything.

Each match costs Tactica about 14 BSD calls plus two predict calls, and
Tactica may be waking from sleep, so one call freezes at most `max`
matches (limit, default 4). Anything left over is picked up by the next ping.
"""
import os
import hmac
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Header, HTTPException

from app.config import bsd_get
from app.tactica import (
    get_match_ratings, get_frozen_ratings, is_freezable, freeze_ratings,
)
from app.routers.matches import _extract_events, _parse_kickoff

router = APIRouter()

# BSD league ids, confirmed in app/config.py LEAGUE_NAMES (live /leagues/ dump).
TOP5_LEAGUE_IDS = {1, 3, 4, 5, 6, 7, 8}  # PL, La Liga, Serie A, Bundesliga, Ligue 1, UEFA Champions League, UEFA Europa League


def _check_key(provided: str | None):
    expected = os.environ.get("ADMIN_KEY", "")
    if not expected or not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=403, detail="Forbidden")


def _already_frozen_ids(event_ids: list[int]) -> set[int]:
    if not event_ids:
        return set()
    try:
        from app.supabase import get_supabase
        res = (
            get_supabase().table("match_predictions")
            .select("event_id").in_("event_id", event_ids).execute()
        )
        return {r["event_id"] for r in (res.data or [])}
    except Exception as e:
        print(f"[admin] frozen lookup failed: {e}")
        return set()


@router.get("/admin/freeze-upcoming")
def freeze_upcoming(hours: float = 6, limit: int = 4,
                    x_admin_key: str | None = Header(default=None)):
    _check_key(x_admin_key)

    now = datetime.now(timezone.utc)
    horizon = now + timedelta(hours=hours)

    # Fetch today and tomorrow (UTC) so a window crossing midnight is covered.
    days = {now.strftime("%Y-%m-%d"), horizon.strftime("%Y-%m-%d")}
    candidates = []
    for d in sorted(days):
        data = bsd_get("/events/", params={"date_from": d, "date_to": d, "limit": 500})
        for ev in _extract_events(data):
            lid = ev.get("league_id") or ev.get("tournament_id") or ev.get("competition_id")
            if lid not in TOP5_LEAGUE_IDS or ev.get("id") is None:
                continue
            ko = _parse_kickoff(ev.get("event_date"))
            if ko is None or ko <= now or ko > horizon:
                continue
            candidates.append((ko, ev))
    candidates.sort(key=lambda t: t[0])

    done = _already_frozen_ids([ev["id"] for _, ev in candidates])
    todo = [(ko, ev) for ko, ev in candidates if ev["id"] not in done]

    frozen, failed = [], []
    for ko, ev in todo[:limit]:
        home, away = ev.get("home_team"), ev.get("away_team")
        result = get_match_ratings(home, away)
        if is_freezable(result) and freeze_ratings(ev["id"], home, away, ko.isoformat(), result):
            frozen.append(f"{home} v {away}")
        else:
            failed.append(f"{home} v {away}")

    return {
        "window_hours":   hours,
        "top5_in_window": len(candidates),
        "already_frozen": len(done),
        "frozen_now":     frozen,
        "not_ready":      failed,   # retried automatically on the next ping
        "remaining":      max(0, len(todo) - limit),
    }
