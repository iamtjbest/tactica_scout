"""
app/routers/editor_home.py

The dashboard and the inbox: the two screens an organiser lands on
rather than goes looking for.

Both are deliberately ONE request each. The obvious implementation of a
dashboard is "list my competitions, then fetch each one's fixtures",
which is a request per competition on a phone paying for data. These
assemble server-side instead.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends

from app.deps import require_user
from app.routers.editor import _db, _rows

router = APIRouter()

# How far ahead "what's coming" looks. A fortnight is long enough to be
# useful for a weekend tournament and short enough that a season-long
# league doesn't return its entire fixture list.
HORIZON_DAYS = 14


def _my_tournament_ids(user: dict) -> dict[str, dict]:
    """Every competition this user can touch, owned or collaborated on,
    keyed by id."""
    memberships = _rows(
        _db().table("tournament_members").select("tournament_id, role")
        .eq("user_id", user["id"]).execute()
    )
    role_by_id = {m["tournament_id"]: m["role"] for m in memberships}
    if not role_by_id:
        return {}

    rows = _rows(
        _db().table("tournaments").select("*")
        .in_("id", list(role_by_id)).execute()
    )
    for t in rows:
        t["_role"] = role_by_id.get(t["id"], "editor")
    return {t["id"]: t for t in rows}


@router.get("/editor/dashboard")
def dashboard(user: dict = Depends(require_user)):
    """Everything the landing screen shows, in one round trip."""
    mine = _my_tournament_ids(user)
    ids = list(mine)

    counts = {"approved": 0, "pending": 0, "draft": 0, "rejected": 0, "unpublished": 0}
    for t in mine.values():
        if t["status"] in counts:
            counts[t["status"]] += 1

    live: list[dict] = []
    upcoming: list[dict] = []
    recent: list[dict] = []
    needs_attention: list[dict] = []
    open_requests = 0

    if ids:
        today = date.today()
        horizon = (today + timedelta(days=HORIZON_DAYS)).isoformat()
        since = (datetime.now(timezone.utc) - timedelta(days=3)).isoformat()

        fixtures = _rows(
            _db().table("fixtures")
            .select("id, tournament_id, round, group_name, kickoff_at, venue, status, "
                    "home_score, away_score, home_team_id, away_team_id")
            .in_("tournament_id", ids)
            .lte("kickoff_at", horizon)
            .gte("kickoff_at", since)
            .order("kickoff_at")
            .execute()
        )

        # One lookup for every team on screen, rather than per fixture.
        teams = _rows(
            _db().table("tournament_teams")
            .select("id, tournament_id, clubs(id, name, crest_url)")
            .in_("tournament_id", ids).execute()
        )
        team_by_id = {
            x["id"]: {
                "name": (x.get("clubs") or {}).get("name") or "Unknown",
                "crest_url": (x.get("clubs") or {}).get("crest_url"),
            }
            for x in teams
        }

        def shape(fx: dict) -> dict:
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
            elif status in {"scheduled"}:
                upcoming.append(shape(fx))

        # Newest results first; the rest stay in kickoff order.
        recent.reverse()
        recent = recent[:5]
        upcoming = upcoming[:8]

        owned = [t["id"] for t in mine.values() if t["_role"] == "owner"]
        if owned:
            reqs = _rows(
                _db().table("tournament_access_requests").select("id")
                .in_("tournament_id", owned).eq("status", "pending").execute()
            )
            open_requests = len(reqs)

    # What the organiser should actually do next, in priority order. A
    # dashboard that only shows numbers makes you work out the next step
    # yourself, which is the part worth automating.
    for t in mine.values():
        if t["status"] == "rejected":
            needs_attention.append({
                "tournament_id": t["id"], "name": t["name"],
                "kind": "rejected",
                "detail": t.get("rejection_reason") or "Sent back for changes.",
            })
        elif t["status"] == "draft":
            needs_attention.append({
                "tournament_id": t["id"], "name": t["name"],
                "kind": "draft",
                "detail": "Not submitted yet. Nothing appears on Scout until it is.",
            })

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
    """Things waiting on the organiser personally.

    Access requests to competitions they own, and review decisions on
    competitions they submitted. Both are things that arrive rather than
    things you go and look for, which is what makes them an inbox.
    """
    mine = _my_tournament_ids(user)
    owned = [t["id"] for t in mine.values() if t["_role"] == "owner"]

    requests: list[dict] = []
    if owned:
        rows = _rows(
            _db().table("tournament_access_requests")
            .select("*, profiles(id, email, display_name)")
            .in_("tournament_id", owned).eq("status", "pending")
            .order("created_at", desc=True).execute()
        )
        for r in rows:
            t = mine.get(r["tournament_id"], {})
            requests.append({**r, "tournament_name": t.get("name")})

    # Review outcomes, newest first. Approved and rejected both matter:
    # one is the thing you were waiting for, the other needs action.
    decisions = []
    for t in mine.values():
        if t["_role"] != "owner":
            continue
        if t["status"] in {"approved", "rejected"} and t.get("reviewed_at"):
            decisions.append({
                "tournament_id": t["id"],
                "tournament_name": t["name"],
                "status": t["status"],
                "reviewed_at": t.get("reviewed_at"),
                "reason": t.get("rejection_reason"),
            })
    decisions.sort(key=lambda d: d.get("reviewed_at") or "", reverse=True)

    return {
        "requests": requests,
        "decisions": decisions[:10],
        "unread": len(requests),
    }
