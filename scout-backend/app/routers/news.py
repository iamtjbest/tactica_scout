"""
GET /api/news
The News tab's feed. Two sources, merged and sorted newest-first:

1. Medium articles, pulled automatically via Medium's public per-profile
   RSS feed (medium.com/feed/@handle) — no account or API key needed,
   this is a plain public endpoint.
2. X posts, added by hand. X doesn't give free programmatic access to
   pull a timeline anymore, and scraping it breaks constantly and is
   against their terms, so rather than promising an auto-sync that
   won't hold up, featured X posts live in a small local JSON file
   (app/data/featured_x_posts.json, see app/data/README.md for the
   format) that you edit directly, paste a post's own URL in whenever
   you want it featured.

The blog (blog.tacticaengine.com) isn't live yet. Once it exists, pull its
RSS/sitemap here the same way Medium's is handled below, same pattern,
just another source function merged into the same list.
"""
import json, os, re, time
from xml.etree import ElementTree
from fastapi import APIRouter
from app.config import cache_read, cache_write, cache_age
import requests as _requests

router = APIRouter()

MEDIUM_HANDLE  = os.environ.get("MEDIUM_HANDLE", "iamtjbest")
MEDIUM_RSS_URL = f"https://medium.com/feed/@{MEDIUM_HANDLE}"
NEWS_TTL       = 900  # 15 min — Medium's RSS doesn't update often enough to poll faster

FEATURED_X_POSTS_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "featured_x_posts.json")


def _load_x_posts() -> list[dict]:
    try:
        with open(FEATURED_X_POSTS_PATH, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []


def _strip_html(raw: str) -> str:
    return re.sub("<[^<]+?>", "", raw or "").strip()


def _parse_medium_rss() -> tuple[list[dict], str | None]:
    """Medium's <description> is full HTML, stripped down here to a
    plain-text excerpt rather than shipping raw Medium HTML to the
    frontend to render.

    Returns (items, error). The error string is the point: this used to
    swallow every failure into an empty list, so a wrong handle, a 404,
    a timeout and "this author has published nothing" were all the same
    blank tab with nothing to debug.
    """
    try:
        resp = _requests.get(MEDIUM_RSS_URL, timeout=10)
        if resp.status_code != 200:
            return [], f"medium returned {resp.status_code} for @{MEDIUM_HANDLE}"
        root = ElementTree.fromstring(resp.content)
        items = []
        for item in root.findall("./channel/item"):
            text = _strip_html(item.findtext("description") or "")
            excerpt = (text[:200] + "...") if len(text) > 200 else text
            items.append({
                "source":    "medium",
                "title":     item.findtext("title") or "",
                "url":       item.findtext("link") or "",
                "excerpt":   excerpt,
                "published": item.findtext("pubDate") or "",
            })
        if not items:
            return [], f"@{MEDIUM_HANDLE}'s feed parsed but has no articles"
        return items, None
    except Exception as exc:
        return [], f"medium fetch failed: {type(exc).__name__}"


@router.get("/news")
def news_feed():
    cache_key = "news_feed__all"
    cached    = cache_read(cache_key)
    if cached and cache_age(cached) < NEWS_TTL:
        cached["cached"] = True
        return cached

    medium_items, medium_error = _parse_medium_rss()
    x_items = [
        {
            "source":    "x",
            "title":     p.get("caption", ""),
            "url":       p.get("url", ""),
            "excerpt":   "",
            "published": p.get("date", ""),
        }
        for p in _load_x_posts()
    ]

    items = medium_items + x_items
    # Best-effort newest-first sort — Medium's pubDate and the manual
    # posts' date string aren't guaranteed the same format, so this is
    # a rough lexical sort rather than failing the whole endpoint over
    # one odd date string.
    items.sort(key=lambda i: i.get("published", ""), reverse=True)

    result = {
        "_cached_at": time.time(),
        "count":      len(items),
        "items":      items,
        # Named sources so an empty tab can say which half is missing
        # and why, instead of just showing nothing.
        "sources": {
            "medium": {
                "handle": MEDIUM_HANDLE,
                "count":  len(medium_items),
                "error":  medium_error,
            },
            "x": {
                "count": len(x_items),
                "error": None if x_items else "no posts in featured_x_posts.json",
            },
        },
        "cached":     False,
    }
    # A failed fetch must not sit in cache for the full 15 minutes.
    if items or not medium_error:
        cache_write(cache_key, result)
    return result