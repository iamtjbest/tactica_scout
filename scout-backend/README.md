# Scout by Tactica — Backend

Livescore + player comparison API. Separate service from the main
Tactica engine backend, same BSD data source.

## Run locally

```bash
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in BSD_API_KEY if not already set
uvicorn app.main:app --reload
```

Then hit `http://localhost:8000/api/health` to confirm it's up, and
`http://localhost:8000/docs` for the interactive Swagger UI, which is
the fastest way to test each endpoint by hand before wiring up the
frontend.

## Before you build against these endpoints

Two of them call BSD paths that are NOT yet confirmed to exist or
return what the code assumes — test these in Postman first, same way
we confirmed `/players/` and `/players/{id}/stats/`:

1. `GET https://sports.bzzoiro.com/api/v2/events/{id}/` — base match
   info for the Overview tab. Grab a real `event_id` from
   `/events/live/` (the `id` field on an event, if it has one — also
   unconfirmed, see `app/routers/live.py`) and test this directly.
2. A real head-to-head endpoint, if BSD has one. `app/routers/matches.py`
   currently builds H2H by pulling the home team's fixture list and
   filtering for the away team's name instead, which works but is a
   workaround, not the real thing.

Paste back whatever those two return and I'll tighten up `matches.py`
and `live.py` to match the real field names, same as we did for the
player stats endpoint.

## Season filtering caveat

`/players/{id}/radar` currently filters by `team_id` (a club spell),
not a true season label, because the per-match stats records don't
carry a date. See the docstring in `app/routers/compare.py` for the
full explanation and what to test to fix it properly.

## Deploy

Same pattern as the main Tactica backend: push to GitHub, connect the
repo on Render, set `BSD_API_KEY` as an environment variable there.
`Procfile` is already set up for it.
