"""
Scout by Tactica — FastAPI Backend
=============================================================
Serves both the Scout web app and the Scout mobile app. Separate
service from the main Tactica backend (app.tactica.com.ng's engine) —
same BSD data source, same auth token, own cache namespace, own repo.

Auth is Supabase Auth. The frontend signs in, verifies email codes and
resets passwords against Supabase directly, then sends us the access
token. This backend has no signup/login endpoint, never handles a
password, and never sends an email.

Endpoints:
  GET  /api/live-scores               → all live/upcoming matches grouped by league
  GET  /api/matches-by-date           → Matches tab, every match for one calendar day, grouped by league
  GET  /api/matches/{event_id}        → match detail (overview, lineups, h2h, facts, stats)
  GET  /api/leagues                   → Leagues tab, pickable list of competitions
  GET  /api/standings                 → Leagues tab, table for one competition
  GET  /api/news                      → News tab, Medium RSS + manually featured X posts
  GET  /api/players/search            → player search by name
  GET  /api/players/{id}/seasons      → club-spell / season breakdown for the comparison screen's dropdown
  GET  /api/players/{id}/radar        → 6-axis radar aggregation for player comparison
  GET  /api/auth/me                   → current account (Authorization: Bearer <supabase_access_token>)
  POST /api/me/followed-teams         → update followed teams (auth required)
  POST /api/me/settings               → update language, etc. (auth required)
  GET  /api/health                    → health check
"""
import os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.routers import (
    live, matches, players, compare, leagues, news, me, teams, search, admin,
    editor, editor_fixtures, editor_review, tournaments_public, billing,
    editor_media, editor_members, editor_structure, editor_home,
)

app = FastAPI(
    title="Scout by Tactica API",
    description="Livescore + player comparison backend for Scout by Tactica",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        # Scout
        "https://scout.tactica.com.ng",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        # Scout Editor. It runs on 3001 so it can sit alongside Scout in
        # dev; leaving it out of this list is why the editor reported
        # "Failed to fetch" -- a CORS rejection looks identical to a
        # dead network from the browser's side.
        "https://editor.tactica.com.ng",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",  # preview deployments
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(live.router,     prefix="/api")
app.include_router(matches.router,  prefix="/api")
app.include_router(players.router,  prefix="/api")
app.include_router(compare.router,  prefix="/api")
app.include_router(leagues.router,  prefix="/api")
app.include_router(news.router,     prefix="/api")
app.include_router(me.router,       prefix="/api")
app.include_router(teams.router,    prefix="/api")
app.include_router(search.router,   prefix="/api")
app.include_router(admin.router,    prefix="/api")
app.include_router(editor.router,            prefix="/api")
app.include_router(editor_fixtures.router,   prefix="/api")
app.include_router(editor_review.router,     prefix="/api")
app.include_router(tournaments_public.router, prefix="/api")
app.include_router(billing.router,           prefix="/api")
app.include_router(editor_media.router,      prefix="/api")
app.include_router(editor_members.router,    prefix="/api")
app.include_router(editor_structure.router,  prefix="/api")
app.include_router(editor_home.router,       prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Scout by Tactica API"}

@app.get("/api/debug-bsd")
def debug_bsd(request: Request, path: str):
    from app.config import bsd_get
    params = dict(request.query_params)
    params.pop("path", None)
    return bsd_get(path, params=params)
