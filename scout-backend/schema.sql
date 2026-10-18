-- ============================================================
-- Scout by Tactica — core schema (Supabase / Postgres)
--
-- Auth is Supabase Auth. Accounts live in auth.users, which Supabase
-- manages. Our own per-user data lives in public.profiles, keyed to
-- the same id, created automatically by a trigger.
--
-- The table is called `profiles` and not `users` on purpose: there is
-- already an auth.users, and two tables named users in one database is
-- how people end up writing a query against the wrong one.
--
-- Access is backend-only through the service role key. RLS is enabled
-- with no policies, so nothing else gets in.
-- Run this whole file in the Supabase SQL editor, top to bottom.
-- ============================================================

-- ---------- enums ----------
create type user_role          as enum ('user', 'admin');
create type tournament_level   as enum ('department', 'faculty', 'src', 'open');
create type tournament_gender  as enum ('male', 'female', 'mixed');
create type tournament_format  as enum ('league', 'knockout', 'groups_knockout');
create type tournament_status  as enum ('draft', 'pending', 'approved', 'rejected', 'unpublished');
create type proof_type         as enum ('link', 'document', 'screenshot');
create type fixture_status     as enum ('scheduled', 'live', 'ht', 'ft', 'postponed', 'cancelled');
create type event_type         as enum (
  'goal', 'own_goal', 'penalty_scored', 'penalty_missed',
  'yellow', 'second_yellow', 'red', 'substitution'
);
create type plan_tier          as enum ('free', 'basic', 'pro', 'unlimited');

-- ---------- updated_at helper ----------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- PROFILES
-- One row per Supabase Auth account. Supabase owns the credentials,
-- email verification and password resets. This table owns everything
-- the app cares about: role, followed teams, language.
-- ============================================================
create table profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  email           text,
  display_name    text,
  phone           text,
  role            user_role not null default 'user',
  followed_teams  jsonb not null default '[]',
  language        text not null default 'en',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- Create the profile the instant an account is created, whatever route
-- it came in by (app signup, dashboard, social login later on).
-- security definer because this runs as the auth system, not as us.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Admin is granted by hand here in the table editor, never by anything
-- a client can send:
--     update profiles set role = 'admin' where email = 'you@example.com';

-- ============================================================
-- CLUBS  (global — a department/faculty team persists across tournaments)
-- ============================================================
create table clubs (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  short_name   text,
  crest_url    text,
  institution  text,                 -- e.g. 'ABU Zaria'
  created_by   uuid references profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index clubs_name_institution_idx
  on clubs (lower(name), lower(coalesce(institution, '')));
create trigger clubs_updated_at before update on clubs
  for each row execute function set_updated_at();

-- ============================================================
-- PLAYERS  (global — career stats accumulate here)
-- ============================================================
create table players (
  id           uuid primary key default gen_random_uuid(),
  first_name   text not null,
  last_name    text not null,
  dob          date not null,        -- required: no placeholders
  position     text,
  photo_url    text,
  nationality  text default 'Nigeria',
  created_by   uuid references profiles (id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index players_name_idx on players (lower(last_name), lower(first_name));
create unique index players_identity_idx on players (lower(first_name), lower(last_name), dob);
create trigger players_updated_at before update on players
  for each row execute function set_updated_at();

-- ============================================================
-- TOURNAMENTS
-- Organisers build a draft freely, then submit for review. Approval
-- gates publishing, not creation.
-- ============================================================
create table tournaments (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references profiles (id),

  -- basics
  name                  text not null,
  sport                 text not null default 'football',
  level                 tournament_level not null,
  gender                tournament_gender not null default 'male',
  age_category          text,
  country               text not null default 'Nigeria',
  start_date            date not null,
  end_date              date not null,
  format                tournament_format not null,

  -- rules
  tiebreakers           jsonb default '["goal_difference","goals_scored","head_to_head"]',
  discipline_rules      jsonb default '{"yellows_to_suspension":3,"red_card_ban_matches":1}',

  -- organiser details
  organizing_body       text not null,
  organizer_phone       text not null,
  contact2_name         text,
  contact2_phone        text,

  -- review workflow
  status                tournament_status not null default 'draft',
  rejection_reason      text,
  submitted_at          timestamptz,
  reviewed_at           timestamptz,
  reviewed_by           uuid references profiles (id),

  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),

  constraint tournaments_dates_valid check (end_date >= start_date)
);
create index tournaments_status_idx on tournaments (status);
create index tournaments_owner_idx  on tournaments (owner_id);
create trigger tournaments_updated_at before update on tournaments
  for each row execute function set_updated_at();

-- ============================================================
-- PROOF OF LEGITIMACY
-- Our own limits: 1 link minimum OR up to 5 files at 5 MB each. Kept
-- small on purpose — student phones, data costs. Nothing here enforces
-- that, it's backend validation. Files go in a Supabase Storage bucket
-- and we store the path in url.
-- ============================================================
create table tournament_proofs (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  type           proof_type not null,
  url            text not null,
  note           text,
  created_at     timestamptz not null default now()
);
create index tournament_proofs_tournament_idx on tournament_proofs (tournament_id);

-- ============================================================
-- TOURNAMENT TEAMS  (a club entered into a tournament)
-- ============================================================
create table tournament_teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  club_id        uuid not null references clubs (id),
  group_name     text,
  home_color     text,
  away_color     text,
  created_at     timestamptz not null default now(),
  unique (tournament_id, club_id)
);
create index tournament_teams_tournament_idx on tournament_teams (tournament_id);

-- ============================================================
-- PLAYER REGISTRATIONS  (player signed on for one team in one tournament)
-- ============================================================
create table player_registrations (
  id                   uuid primary key default gen_random_uuid(),
  player_id            uuid not null references players (id),
  tournament_team_id   uuid not null references tournament_teams (id) on delete cascade,
  jersey_number        int,
  position             text,
  created_at           timestamptz not null default now(),
  unique (player_id, tournament_team_id)
);
create index player_reg_player_idx on player_registrations (player_id);
create index player_reg_team_idx   on player_registrations (tournament_team_id);

-- ============================================================
-- FIXTURES
-- ============================================================
create table fixtures (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments (id) on delete cascade,
  round           text,
  group_name      text,
  home_team_id    uuid not null references tournament_teams (id),
  away_team_id    uuid not null references tournament_teams (id),
  kickoff_at      timestamptz not null,
  venue           text,
  status          fixture_status not null default 'scheduled',
  home_score      int,
  away_score      int,
  ht_home_score   int,
  ht_away_score   int,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint fixtures_teams_differ check (home_team_id <> away_team_id)
);
create index fixtures_tournament_idx on fixtures (tournament_id);
create index fixtures_kickoff_idx    on fixtures (kickoff_at);
create index fixtures_status_idx     on fixtures (status);
create trigger fixtures_updated_at before update on fixtures
  for each row execute function set_updated_at();

-- ============================================================
-- MATCH EVENTS
-- References the GLOBAL player_id so career stats accumulate.
-- ============================================================
create table match_events (
  id                  uuid primary key default gen_random_uuid(),
  fixture_id          uuid not null references fixtures (id) on delete cascade,
  tournament_team_id  uuid not null references tournament_teams (id),
  player_id           uuid references players (id),
  related_player_id   uuid references players (id),   -- assist provider / sub on
  type                event_type not null,
  minute              int,
  created_by          uuid references profiles (id),
  created_at          timestamptz not null default now()
);
create index match_events_fixture_idx on match_events (fixture_id);
create index match_events_player_idx  on match_events (player_id);
create index match_events_type_idx    on match_events (type);

-- Standings and top-scorer tables are computed from fixtures +
-- match_events in the backend. Don't store them until a query hurts.

-- ============================================================
-- MONETISATION (graphics) — for the paid phase.
-- Additive, safe to leave unused for now.
-- Free 10 / basic 25 / pro 50 / unlimited (-1).
-- ============================================================
create table subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles (id) on delete cascade,
  plan            plan_tier not null default 'free',
  image_quota     int not null default 10,
  images_used     int not null default 0,
  period_start    timestamptz not null default now(),
  period_end      timestamptz,
  paystack_ref    text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index subscriptions_user_idx on subscriptions (user_id);
create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create table generated_images (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references profiles (id) on delete cascade,
  fixture_id     uuid references fixtures (id) on delete set null,
  kind           text not null,          -- 'prematch' | 'ft'
  image_url      text not null,
  created_at     timestamptz not null default now()
);
create index generated_images_user_idx on generated_images (user_id);

-- ============================================================
-- LOCK THE TABLES DOWN
-- RLS on with no policies = nothing gets through except the service
-- role key the backend uses. If the anon key leaks, tables stay shut.
-- Add real policies only if a client starts talking to Supabase
-- directly (realtime live scores, say).
-- ============================================================
alter table profiles             enable row level security;
alter table clubs                enable row level security;
alter table players              enable row level security;
alter table tournaments          enable row level security;
alter table tournament_proofs    enable row level security;
alter table tournament_teams     enable row level security;
alter table player_registrations enable row level security;
alter table fixtures             enable row level security;
alter table match_events         enable row level security;
alter table subscriptions        enable row level security;
alter table generated_images     enable row level security;
