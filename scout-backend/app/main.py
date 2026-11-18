"""
Scout by Tactica — FastAPI Backend
=============================================================
Serves both the Scout web app and the Scout mobile app.
"""
import threading
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.notifications import run_notification_tick
from app.routers import (
    live, matches, players, compare, leagues, news, me, teams, search, admin,
    editor, editor_fixtures, editor_review, tournaments_public, billing,
    editor_media, editor_members, editor_structure, ratings, editor_lineups, editor_home,
)


def _notification_worker(stop_event: threading.Event) -> None:
    while not stop_event.is_set():
        run_notification_tick()
        stop_event.wait(45)


@asynccontextmanager
async def lifespan(app: FastAPI):
    stop_event = threading.Event()
    worker = threading.Thread(target=_notification_worker, args=(stop_event,), daemon=True)
    worker.start()
    yield
    stop_event.set()


app = FastAPI(
    title="Scout by Tactica API",
    description="Livescore + player comparison backend for Scout by Tactica",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://scout.tacticaengine.com",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://scouteditor.tacticaengine.com",
        "https://editor.tacticaengine.com",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(live.router,               prefix="/api")
app.include_router(matches.router,            prefix="/api")
app.include_router(players.router,            prefix="/api")
app.include_router(compare.router,            prefix="/api")
app.include_router(leagues.router,            prefix="/api")
app.include_router(news.router,               prefix="/api")
app.include_router(me.router,                 prefix="/api")
app.include_router(teams.router,              prefix="/api")
app.include_router(search.router,             prefix="/api")
app.include_router(admin.router,              prefix="/api")
app.include_router(editor.router,             prefix="/api")
app.include_router(editor_fixtures.router,    prefix="/api")
app.include_router(editor_review.router,      prefix="/api")
app.include_router(tournaments_public.router, prefix="/api")
app.include_router(billing.router,            prefix="/api")
app.include_router(editor_media.router,       prefix="/api")
app.include_router(editor_members.router,     prefix="/api")
app.include_router(editor_structure.router,   prefix="/api")
app.include_router(editor_home.router,        prefix="/api")
app.include_router(ratings.router,            prefix="/api")
app.include_router(editor_lineups.router,     prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "Scout by Tactica API"}


@app.get("/api/debug-bsd")
def debug_bsd(request: Request, path: str):
    from app.config import bsd_get
    params = dict(request.query_params)
    params.pop("path", None)
    return bsd_get(path, params=params)