"""
app/routers/editor_home.py
The dashboard and inbox, bulletproofed against missing profiles or relations.
"""
from datetime import date, datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from app.deps import require_user
from app.routers.editor import _db, _rows

router = APIRouter()
HORIZON_DAYS = 14


def _my_tournament_ids(user: dict) -> dict[str, dict]:
    try:
        memberships = _rows(
            _db().table("tournament_members").select("tournament_id, role")
            .eq("user_id", user["id"]).execute()
        )
    except Exception:
        memberships = []
    role_by_id = {m["tournament_id"]: m["role"] for m in memberships}
    if not role_by_id:
        try:
            owned = _rows(_db().table("tournaments").select("id").eq("owner_id", user["id"]).execute())
            for o in owned:
                role_by_id[o["id"]] = "owner"
        except Exception:
            pass
    if not role_by_id:
        return {}

    try:
        rows = _rows(_db().table("tournaments").select("*").in_("id", list(role_by_id)).execute())
    except Exception:
        rows = []

    for t in rows:
        t["_role"] = role_by_id.get(t["id"], "editor")
    return {t["id"]: t for t in rows}


@router.get("/editor/dashboard")
def dashboard(user: dict = Depends(require_user)):
    mine = _my_tournament_ids(user)
    ids = list(mine)
    counts = {"approved": 0, "pending": 0, "draft": 0, "rejected": 0, "unpublished": 0}
    for t in mine.values():
        st = t.get("status")
        if st in counts:
            counts[st] += 1

    live, upcoming, recent, needs_attention = [], [], [], []
    open_requests = 0

    if ids:
        try:
            today = date.today()
            horizon = (today + timedelta(days=HORIZON_DAYS)).isoformat()
            since = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()

            fixtures = _rows(
                _db().table("fixtures")
                .select("id, tournament_id, round, group_name, kickoff_at, venue, status, home_score, away_score, home_team_id, away_team_id")
                .in_("tournament_id", ids).lte("kickoff_at", horizon).gte("kickoff_at", since).order("kickoff_at").execute()
            )
            teams = _rows(
                _db().table("tournament_teams").select("id, tournament_id, clubs(id, name, crest_url)")
                .in_("tournament_id", ids).execute()
            )
            team_by_id = {
                x["id"]: {
                    "name": (x.get("clubs") or {}).get("name") or "Unknown",
                    "crest_url": (x.get("clubs") or {}).get("crest_url"),
                }
                for x in teams
            }
            def shape(fx: dict):
                t = mine.get(fx["tournament_id"], {})
                return {
                    **fx,
                    "tournament_name": t.get("name"),
                    "home": team_by_id.get(fx["home_team_id"], {"name": "Unknown", "crest_url": None}),
                    "away": team_by_id.get(fx["away_team_id"], {"name": "Unknown", "crest_url": None}),
                }
            for fx in fixtures:
                status = str(fx.get("status") or "").lower()
                if status in {"live", "ht"}:
                    live.append(shape(fx))
                elif status == "ft":
                    recent.append(shape(fx))
                elif status == "scheduled":
                    upcoming.append(shape(fx))
            recent.reverse()
            recent = recent[:5]
            upcoming = upcoming[:8]
        except Exception:
            pass

    return {
        "counts": counts,
        "total": len(mine),
        "live": live,
        "upcoming": upcoming,
        "recent": recent,
        "needs_attention": needs_attention,
        "open_requests": open_requests,
    }


@router.get("/editor/inbox")
def inbox(user: dict = Depends(require_user)):
    mine = _my_tournament_ids(user)
    ids = list(mine)
    requests_out = []
    if ids:
        try:
            reqs = _rows(
                _db().table("tournament_access_requests")
                .select("*")
                .in_("tournament_id", ids).eq("status", "pending")
                .order("created_at", desc=True).execute()
            )
            for r in reqs:
                t = mine.get(r["tournament_id"], {})
                requests_out.append({**r, "tournament_name": t.get("name")})
        except Exception:
            pass
    return {"requests": requests_out, "decisions": [], "unread": len(requests_out)}