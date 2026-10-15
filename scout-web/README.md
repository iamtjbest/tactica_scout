# Scout by Tactica — Web App

Next.js 14, same visual system as the main Tactica web app (dark
bunker background, volt/cyan accents, Playfair Display + DM Sans).

## Run locally

```bash
npm install
cp .env.example .env.local     # point NEXT_PUBLIC_API_URL at your local backend
npm run dev
```

Make sure the Scout backend is running first (`uvicorn app.main:app --reload`
in that repo) — this app does nothing useful without it.

## What's built

- **Home (`/`)** — live scores grouped by league, polls every 30 seconds.
  Tap a match to open its detail page. If a match card doesn't open on tap,
  that's the unconfirmed `event_id` field on `/events/live/` biting us,
  see the backend README.
- **Match detail (`/match/[id]`)** — Overview, Lineups, H2H, Facts tabs.
  Lineups will work once the backend's confirmed lineup call returns real
  data. Facts is a placeholder shell until the main Tactica backend's
  rating endpoints get wired into it.
- **Compare (`/compare`)** — search two players, pick a club spell (not a
  true season yet, see backend notes), see a 6-axis radar overlay plus a
  numeric breakdown table underneath.

## Known gaps, not bugs

1. Season filtering reads "club spell" in the UI on purpose, it's
   filtering by `team_id` because BSD's stats endpoint doesn't carry
   match dates. Don't relabel this to "Season" in the UI until the
   backend actually supports it, that would be lying to the user about
   what they're picking.
2. The Facts tab on match detail has no real Tactica numbers in it yet,
   that's the next build step once match detail itself is confirmed
   working end to end.
3. No image/badge support for teams or players yet, this is text-only
   for now. BSD's player and team payloads don't appear to include logo
   URLs based on what we've seen so far, worth checking the team detail
   endpoint for that if you want crests in before launch.

## Deploy

Vercel, same as the main Tactica web app. Set `NEXT_PUBLIC_API_URL` to
wherever the Scout backend ends up (Render, most likely, matching the
main backend's hosting).
