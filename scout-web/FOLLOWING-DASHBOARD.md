# Scout — Status & What's Left

Last updated: 2026-10-19

This started as a "future database implementations" note written before
any database existed. The database exists now, so most of the original
plan is either built or was superseded. Kept here as the single place to
see what's done, what's broken, and what's next.

---

## Done

**Supabase project `scout-production`** (Frankfurt, `hpgaaqkytifdqajpdtlu`)
- Full schema applied: `profiles`, `clubs`, `players`, `tournaments`,
  `tournament_proofs`, `tournament_teams`, `player_registrations`,
  `fixtures`, `match_events`, `subscriptions`, `generated_images`
- `on_auth_user_created` trigger creates the profile row on signup and
  carries `signup_source` and `referred_by_tournament_id` through from
  the client
- RLS enabled on every table with zero policies, so only the backend's
  service role key gets in
- Project is on asymmetric JWT signing keys (ES256)

**Email** — Resend, `tactica.com.ng` verified (DKIM + both SPF CNAMEs)
- Custom SMTP wired into Supabase
- Six templates styled in the Tactica system: confirm signup, reset
  password, magic link, change email, password changed, email changed
- Confirm email ON, OTP 900s / 6 digits, secure email change ON,
  require current password ON

**Backend** — `tactica-scout-api` on Render (Frankfurt, free tier), v0.2.0
- File-based auth deleted. `app/deps.py` verifies Supabase tokens
  against JWKS, falling back to the auth server on legacy-key projects
- `require_user` / `require_admin` / `optional_user`
- `/api/auth/me`, `/api/me/followed-teams`, `/api/me/settings`
- BSD endpoints all returning live data

**scout-web auth**
- `/signup` → `/verify` (6-digit code, 60s resend cooldown) → signed in
- `/signin`, `/forgot-password`, `/reset-password`
- `FollowButton` works on team, league and player pages
- `lib/auth.ts` owns all Supabase auth; `lib/api.ts` just attaches the
  bearer token

---

## Broken right now

**scout-mobile auth is dead.** `src/services/api.ts` still calls
`/api/auth/signup` and `/api/auth/login`, which no longer exist on the
backend. The mobile app needs the same treatment scout-web just got:
`@supabase/supabase-js`, a `lib/auth` equivalent, and signup / verify /
signin / forgot / reset screens. Nothing else in the app is affected,
only auth.

Also in scout-mobile:
- `.env` points at a dead ngrok tunnel, should be
  `https://tactica-scout-api.onrender.com`
- `ProfileScreen.tsx:305` placeholder says `tactica-scout.onrender.com`,
  missing the `-api`

---

## Next up

1. **Test the auth chain end to end.** Signup on scout-web, confirm the
   code email actually arrives and renders, verify, then confirm
   `/api/auth/me` returns a user and a row appeared in `profiles`.
   Nothing downstream is trustworthy until this passes.
2. **Supabase URL Configuration.** Register `http://localhost:3000`,
   `https://scout.tactica.com.ng`, and later the editor domain and the
   mobile deep link. Auth fails silently on any URL not listed.
3. **Rotate the BSD API key.** The old one is in public git history on a
   public repo. Replace it in Render, put a placeholder in
   `.env.example`.
4. **scout-mobile auth**, mirroring scout-web.
5. **Password policy.** Supabase is still on the strictest composition
   rule (upper + lower + digits + symbols) with an 8-character minimum.
   NIST SP 800-63B Rev 4 says not to impose composition rules at all.
   Drop them and raise the minimum to 12.

---

## Known rough edges

- **Debug payloads shipping to clients.** `/api/matches/{id}` returns
  `_debug_sample_event`, `_debug_base_keys` and
  `_debug_incidents_sample`. The first alone is hundreds of lines of raw
  BSD payload on every match response. Strip them.
- **Tactica facts are null.** `/api/matches/{id}` returns
  `facts: {tactica_atk_rating: null, tactica_def_rating: null,
  tactica_win_prob: null}`. That's the Facts tab differentiator and it
  isn't wired to anything yet.
- **`followed_teams` is a jsonb array of `"type:id:name"` strings** on
  `profiles`, not a join table. Fine for a list the user reads back, but
  you cannot ask "how many people follow team 44" without scanning every
  row. If follower counts or "people who follow X also follow Y" ever
  matter, this becomes a proper `user_favorites` table.
- **Free-tier constraints.** Render spins down after 15 minutes idle
  (~1 min cold start). Resend is capped at 100 emails/day, which is the
  ceiling on signups per day. Brevo (~300/day) is the escape hatch, and
  swapping SMTP provider is a settings change, not a migration.

---

## The following dashboard itself

Still not built. The data is all there now, this is purely frontend plus
one endpoint.

- `GET /api/dashboard` — fixtures and results filtered to the caller's
  followed teams and leagues, grouped by league
- A Dashboard / Favourites tab on the homepage that reads it
- Empty state pointing at the Follow button when nothing is followed

The original plan called for separate `POST`/`DELETE` favourites
endpoints. Superseded: `POST /api/me/followed-teams` replaces the whole
array in one call, which is simpler and already built.

---

## Phase 3 — deeper football context

Unchanged from the original plan, still future work.

**Transfer Center** — confirmed transfers, loans and rumours, filterable
by league or team. Needs a transfer-events schema linked to player and
team profiles, plus a transfer feed or API.

**Injuries & Suspensions** — pre-match roster showing who's unavailable
and why. Cross-reference squad lists against BSD's `injury_type`.

Note: suspensions are a different problem for tournaments run in the
editor, where we compute them ourselves from `match_events` and the
tournament's own `discipline_rules`. That one is ours to build, not
BSD's to supply.

**Tournament Brackets** — visual progression trees for knockout
competitions. Needed twice over: once for BSD competitions like the
Champions League, once for knockout tournaments created in the editor.

**TV & Streaming Schedules** — which channel is showing the game in the
user's region. Needs geo mapping against BSD's `/broadcasts/` endpoint.

---

## Not in this repo yet

The **editor app**, the organizer-facing tool for running tournaments.
Decided but unbuilt:

- Organizers build a tournament as a private draft, then submit for
  review. The gate is on publishing, not creating.
- Statuses: draft → pending → approved / rejected (with a reason, and
  resubmittable). Admin can also unpublish.
- Application collects competition basics, organizer contacts, teams
  and players with real dates of birth, opening fixtures, and proof of
  legitimacy (a public link, documents, or a WhatsApp schedule
  screenshot for grassroots).
- Same Supabase project, same `profiles`. Being an organizer means
  owning a tournament, not holding a special role.
- Monetization: tournament hosting is unlimited and free. The paid tier
  is AI-generated match graphics — 10 free, then ₦5k/25, ₦10k/50,
  ₦25k unlimited, billed through Paystack or Flutterwave.
- Match graphics should be rendered from our own templates (HTML/CSS to
  image), not a generative image model. Full brand control, no
  watermark problem, no per-image cost.
