# featured_x_posts.json

X doesn't give free programmatic access to pull a timeline anymore, and
scraping it breaks constantly and is against their terms. So instead of
promising an auto-sync that won't hold up, the News tab's X posts live
here, add an entry by hand whenever you want a post featured.

Format, one object per post:

```json
[
  {
    "url": "https://x.com/TacticaEngine/status/1234567890",
    "caption": "Olise, Cherki, Calafiori: the standout MD4 names",
    "date": "2026-10-06T10:00:00Z"
  }
]
```

`date` controls sort order on the News tab (newest first, mixed in
with Medium articles). Use an ISO date so it sorts correctly next to
Medium's own pubDate strings.
