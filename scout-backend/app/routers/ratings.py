"""
app/routers/ratings.py

Crowd player ratings and Man of the Match voting.

Works for BSD matches (Man Utd, Bayern, anything the livescore carries)
and for local tournaments run in the editor. The two live in one table
with a `source` discriminator -- see ratings_v1.sql for why.

Three rules are enforced here rather than in the client, because a
client-side rule is a suggestion:

  the window   opens at 75', closes 30 minutes after full time
  one vote     one rating per person per player, one MOTM per match
  the floor    no average is shown until MIN_VOTES people have rated,
               so one person cannot tank someone on their own
"""
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.config import bsd_get
from app.deps import require_user
from app.routers.editor import _db, _rows, _one
from app.routers.matches import _FINISHED, _parse_kickoff

router = APIRouter()

SOURCES = {"bsd", "local"}

# Voting opens here. Before 75' there isn't enough of a performance to
# rate, and an early average anchors everyone who votes later.
OPEN_FROM_MINUTE = 75

# Closes 30 minutes after full time.
#
# Neither BSD nor our fixtures table records WHEN a match finished, only
# that it has, so the close is computed from kickoff: 90 minutes, plus
# half time, plus generous stoppage, plus the 30. Deriving it from
# kickoff also means the window is identical for everyone looking at it,
# rather than depending on when our server first noticed the result.
MINUTES_TO_FULL_TIME = 115
CLOSE_AFTER_FT_MINUTES = 30
WINDOW_MINUTES = MINUTES_TO_FULL_TIME + CLOSE_AFTER_FT_MINUTES

# Below this, the crowd average is withheld. A single angry coursemate
# should not be able to publish "2.4/10" against a named player.
MIN_VOTES = 5


class RatingIn(BaseModel):
    # Halves only, matching the DB constraint. 7.4 is false precision on
    # a human judgement and makes the distribution unreadable.
    score: float = Field(ge=1.0, le=10.0)


class MotmIn(BaseModel):
    player_ref: str = Field(min_length=1, max_length=64)


# ── the match, whichever source it came from ─────────────────────────

def _bsd_match(match_ref: str) -> dict:
    try:
        event_id = int(match_ref)
    except ValueError:
        raise HTTPException(status_code=400, detail="A BSD match ref is the numeric event id.")

    base = bsd_get(f"/events/{event_id}/")
    if base is None:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found.")

    return {
        "status":  str(base.get("status") or "").lower(),
        "minute":  base.get("current_minute") or 0,
        "kickoff": _parse_kickoff(base.get("event_date")),
        "home":    base.get("home_team"),
        "away":    base.get("away_team"),
    }


def _local_match(match_ref: str) -> dict:
    fx = _one(
        _db().table("fixtures").select("*").eq("id", match_ref).limit(1).execute()
    )
    if not fx:
        raise HTTPException(status_code=404, detail="Fixture not found.")

    # Only a published competition can be voted on. A draft is nobody's
    # business but the organiser's, and rating players in one would leak
    # that it exists.
    t = _one(
        _db().table("tournaments").select("id, status, name")
        .eq("id", fx["tournament_id"]).limit(1).execute()
    )
    if not t or t["status"] != "approved":
        raise HTTPException(status_code=404, detail="Fixture not found.")

    return {
        "status":  str(fx.get("status") or "").lower(),
        "minute":  90 if str(fx.get("status") or "").lower() in _FINISHED else 0,
        "kickoff": _parse_kickoff(fx.get("kickoff_at")),
        "home":    None,
        "away":    None,
        "_fixture": fx,
    }


def _match(source: str, match_ref: str) -> dict:
    if source not in SOURCES:
        raise HTTPException(status_code=400, detail="source must be 'bsd' or 'local'")
    return _bsd_match(match_ref) if source == "bsd" else _local_match(match_ref)


def _window(m: dict) -> dict:
    """Is voting open, and why not if it isn't."""
    finished = m["status"] in _FINISHED
    minute = int(m.get("minute") or 0)
    kickoff = m.get("kickoff")

    closes_at = kickoff + timedelta(minutes=WINDOW_MINUTES) if kickoff else None
    now = datetime.now(timezone.utc)

    if closes_at and now > closes_at:
        return {"open": False, "reason": "Voting closed 30 minutes after full time.",
                "closes_at": closes_at.isoformat()}

    if not finished and minute < OPEN_FROM_MINUTE:
        return {
            "open": False,
            "reason": f"Voting opens at {OPEN_FROM_MINUTE} minutes.",
            "opens_at_minute": OPEN_FROM_MINUTE,
            "closes_at": closes_at.isoformat() if closes_at else None,
        }

    return {"open": True, "reason": None,
            "closes_at": closes_at.isoformat() if closes_at else None}


# ── who is eligible to be rated ──────────────────────────────────────

def _eligible(source: str, match_ref: str, m: dict) -> set[str]:
    """Everyone who appeared in the match.

    Checked on write so nobody can rate a player who wasn't involved,
    or invent a ref and stuff the leaderboard.
    """
    if source == "bsd":
        data = bsd_get(f"/events/{int(match_ref)}/lineups/") or {}
        out: set[str] = set()
        for side in (data.get("lineups") or {}).values():
            if not isinstance(side, dict):
                continue
            for group in ("players", "substitutes", "subs"):
                for p in side.get(group) or []:
                    pid = p.get("player_id") if isinstance(p, dict) else None
                    if pid is None and isinstance(p, dict):
                        pid = p.get("id") or (p.get("player") or {}).get("id")
                    if pid is not None:
                        out.add(str(pid))
        return out

    fx = m["_fixture"]

    # The team sheet, if the organiser entered one. That is the honest
    # answer to "who played", and it is what the ratings list is built
    # from.
    sheet = _rows(
        _db().table("fixture_lineups").select("player_id")
        .eq("fixture_id", fx["id"]).execute()
    )
    if sheet:
        return {str(r["player_id"]) for r in sheet}

    # No sheet entered: fall back to the whole registered squad of both
    # sides. Looser than it should be, but refusing every vote would
    # mean an organiser who never fills in a team sheet silently kills
    # ratings for their competition.
    regs = _rows(
        _db().table("player_registrations").select("player_id")
        .in_("tournament_team_id", [fx["home_team_id"], fx["away_team_id"]]).execute()
    )
    return {str(r["player_id"]) for r in regs}


# ── reading ──────────────────────────────────────────────────────────

@router.get("/ratings/{source}/{match_ref}")
def get_ratings(source: str, match_ref: str):
    """Crowd averages and the MOTM tally. Public: reading is not gated,
    only voting is."""
    m = _match(source, match_ref)
    window = _window(m)

    ratings = _rows(
        _db().table("player_ratings").select("player_ref, score")
        .eq("source", source).eq("match_ref", match_ref).execute()
    )
    motm = _rows(
        _db().table("motm_votes").select("player_ref")
        .eq("source", source).eq("match_ref", match_ref).execute()
    )

    by_player: dict[str, list[float]] = {}
    for r in ratings:
        by_player.setdefault(str(r["player_ref"]), []).append(float(r["score"]))

    players = []
    for ref, scores in by_player.items():
        n = len(scores)
        players.append({
            "player_ref": ref,
            "votes": n,
            # Withheld below the floor. The count is still returned so the
            # UI can say "3 of 5 votes" rather than looking broken.
            "average": round(sum(scores) / n, 1) if n >= MIN_VOTES else None,
            "enough_votes": n >= MIN_VOTES,
        })
    players.sort(key=lambda p: (p["average"] is None, -(p["average"] or 0), -p["votes"]))

    tally: dict[str, int] = {}
    for v in motm:
        tally[str(v["player_ref"])] = tally.get(str(v["player_ref"]), 0) + 1
    total_motm = sum(tally.values())

    motm_rows = sorted(
        ({"player_ref": k, "votes": v,
          "share": round(v * 100 / total_motm) if total_motm else 0}
         for k, v in tally.items()),
        key=lambda x: -x["votes"],
    )

    return {
        "source": source,
        "match_ref": match_ref,
        "window": window,
        "min_votes": MIN_VOTES,
        "players": players,
        "motm": {"total_votes": total_motm, "leaders": motm_rows[:5]},
    }


@router.get("/ratings/{source}/{match_ref}/mine")
def my_votes(source: str, match_ref: str, user: dict = Depends(require_user)):
    """What this person has already voted, so the UI shows their own
    marks instead of making them remember."""
    if source not in SOURCES:
        raise HTTPException(status_code=400, detail="source must be 'bsd' or 'local'")

    mine = _rows(
        _db().table("player_ratings").select("player_ref, score")
        .eq("source", source).eq("match_ref", match_ref)
        .eq("user_id", user["id"]).execute()
    )
    motm = _one(
        _db().table("motm_votes").select("player_ref")
        .eq("source", source).eq("match_ref", match_ref)
        .eq("user_id", user["id"]).limit(1).execute()
    )
    return {
        "ratings": {str(r["player_ref"]): float(r["score"]) for r in mine},
        "motm": motm["player_ref"] if motm else None,
    }


# ── voting ───────────────────────────────────────────────────────────

def _check_open(source: str, match_ref: str, player_ref: str) -> dict:
    m = _match(source, match_ref)
    window = _window(m)
    if not window["open"]:
        raise HTTPException(status_code=409, detail=window["reason"])

    eligible = _eligible(source, match_ref, m)
    # An empty set means the source gave us no lineup at all. Refusing
    # every vote in that case would silently kill the feature on any
    # match without published lineups, so an empty set means "can't
    # check" and the vote is allowed; a non-empty set is enforced.
    if eligible and player_ref not in eligible:
        raise HTTPException(status_code=400, detail="That player didn't play in this match.")
    return m


@router.put("/ratings/{source}/{match_ref}/players/{player_ref}")
def rate_player(source: str, match_ref: str, player_ref: str, body: RatingIn,
                user: dict = Depends(require_user)):
    """Rate one player. PUT, not POST: sending it twice is the same as
    sending it once, and changing your mind is the same call again."""
    if round(body.score * 2) != body.score * 2:
        raise HTTPException(status_code=400, detail="Ratings go in halves: 7.0, 7.5, 8.0.")

    _check_open(source, match_ref, player_ref)

    row = {
        "source": source, "match_ref": match_ref, "player_ref": player_ref,
        "user_id": user["id"], "score": body.score,
    }
    saved = _one(
        _db().table("player_ratings")
        .upsert(row, on_conflict="source,match_ref,player_ref,user_id").execute()
    )
    return saved or row


@router.put("/ratings/{source}/{match_ref}/motm")
def vote_motm(source: str, match_ref: str, body: MotmIn,
              user: dict = Depends(require_user)):
    """One shout per match. Switching your pick overwrites it."""
    _check_open(source, match_ref, body.player_ref)

    row = {
        "source": source, "match_ref": match_ref,
        "player_ref": body.player_ref, "user_id": user["id"],
    }
    saved = _one(
        _db().table("motm_votes")
        .upsert(row, on_conflict="source,match_ref,user_id").execute()
    )
    return saved or row


@router.delete("/ratings/{source}/{match_ref}/players/{player_ref}", status_code=204)
def unrate(source: str, match_ref: str, player_ref: str,
           user: dict = Depends(require_user)):
    """Withdraw a rating. Allowed only while the window is open: pulling
    a vote out of a settled average after the fact changes a published
    number."""
    m = _match(source, match_ref)
    if not _window(m)["open"]:
        raise HTTPException(status_code=409, detail="Voting is closed for this match.")
    _db().table("player_ratings").delete() \
        .eq("source", source).eq("match_ref", match_ref) \
        .eq("player_ref", player_ref).eq("user_id", user["id"]).execute()
    return None
