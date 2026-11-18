-- ============================================================
-- Scout by Tactica — Unified Master Schema (Supabase / Postgres)
-- Consolidated: core + v2 + v3 + v4 + v5 + v6 + match_predictions
--               + tournament_members + ratings_v1 + lineups_v1
--               + notifications_v1
--
-- Access is backend-only through the service role key. RLS is
-- enabled with no policies on every table.
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================
create type user_role as enum ('user', 'admin');

create type tournament_level as enum (
  'department', 'faculty', 'src', 'open',
  'university', 'school', 'youth', 'amateur',
  'semi_professional', 'professional', 'corporate', 'community'
);

create type tournament_gender as enum ('male', 'female', 'mixed');
create type tournament_format as enum ('league', 'knockout', 'groups_knockout');
create type tournament_status as enum ('draft', 'pending', 'approved', 'rejected', 'unpublished');
create type tournament_role   as enum ('owner', 'editor');
create type sub_competition_kind as enum ('league', 'group', 'knockout', 'playoff');
create type proof_type        as enum ('link', 'document', 'screenshot');
create type fixture_status    as enum ('scheduled', 'live', 'ht', 'ft', 'postponed', 'cancelled');

create type event_type as enum (
  'goal', 'own_goal', 'penalty_scored', 'penalty_missed', 'penalty_saved',
  'yellow', 'second_yellow', 'red', 'substitution'
);

create type plan_tier         as enum ('free', 'basic', 'pro', 'unlimited');
create type rating_source     as enum ('bsd', 'local');

-- ============================================================
-- 2. SHARED TRIGGER HELPERS
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- 3. PROFILES & AUTH SYNC
-- ============================================================
create table profiles (
  id                        uuid primary key references auth.users (id) on delete cascade,
  email                     text,
  display_name              text,
  phone                     text,
  role                      user_role not null default 'user',
  followed_teams            jsonb not null default '[]',
  language                  text not null default 'en',
  signup_source             text,
  referred_by_tournament_id uuid,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index profiles_signup_source_idx on profiles (signup_source);
create index profiles_referrer_idx      on profiles (referred_by_tournament_id);

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ref_id uuid;
begin
  begin
    ref_id := nullif(new.raw_user_meta_data ->> 'referred_by_tournament_id', '')::uuid;
  exception when others then
    ref_id := null;
  end;

  insert into public.profiles (
    id, email, display_name, signup_source, referred_by_tournament_id
  )
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    nullif(new.raw_user_meta_data ->> 'signup_source', ''),
    ref_id
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ============================================================
-- 4. GLOBAL CLUBS & PLAYERS
-- ============================================================
create table clubs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short_name  text,
  crest_url   text,
  institution text,
  created_by  uuid references profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create unique index clubs_name_institution_idx
  on clubs (lower(name), lower(coalesce(institution, '')));

create trigger clubs_updated_at before update on clubs
  for each row execute function set_updated_at();

create table players (
  id          uuid primary key default gen_random_uuid(),
  first_name  text not null,
  last_name   text not null,
  dob         date not null,
  position    text,
  photo_url   text,
  nationality text default 'Nigeria',
  created_by  uuid references profiles (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index players_name_idx          on players (lower(last_name), lower(first_name));
create unique index players_identity_idx on players (lower(first_name), lower(last_name), dob);

create trigger players_updated_at before update on players
  for each row execute function set_updated_at();

-- ============================================================
-- 5. TOURNAMENTS & REFERRAL FK
-- ============================================================
create table tournaments (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references profiles (id),

  -- Basics
  name             text not null,
  sport            text not null default 'football',
  level            tournament_level not null,
  gender           tournament_gender not null default 'male',
  age_category     text,
  country          text not null default 'Nigeria',
  start_date       date not null,
  end_date         date not null,
  format           tournament_format not null,
  crest_url        text,

  -- Rules
  tiebreakers      jsonb default '["goal_difference","goals_scored","head_to_head"]',
  points_rules     jsonb not null default '{"win": 3, "draw": 1, "loss": 0}'::jsonb,
  discipline_rules jsonb default '{"yellows_to_suspension":3,"red_card_ban_matches":1}',

  -- Organiser contacts
  organizing_body  text not null,
  organizer_phone  text not null,
  contact_email    text,
  contact2_name    text,
  contact2_phone   text,

  -- Review workflow
  status           tournament_status not null default 'draft',
  rejection_reason text,
  submitted_at     timestamptz,
  reviewed_at      timestamptz,
  reviewed_by      uuid references profiles (id),

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint tournaments_dates_valid check (end_date >= start_date),
  constraint tournaments_points_rules_sane check (
    (points_rules->>'win')::int  between 0 and 10 and
    (points_rules->>'draw')::int between 0 and 10 and
    (points_rules->>'loss')::int between 0 and 10 and
    (points_rules->>'win')::int >= (points_rules->>'draw')::int and
    (points_rules->>'draw')::int >= (points_rules->>'loss')::int
  )
);

create index tournaments_status_idx on tournaments (status);
create index tournaments_owner_idx  on tournaments (owner_id);

create trigger tournaments_updated_at before update on tournaments
  for each row execute function set_updated_at();

alter table profiles
  add constraint profiles_referred_by_tournament_fkey
  foreign key (referred_by_tournament_id)
  references tournaments (id) on delete set null;

-- ============================================================
-- 6. TOURNAMENT PROOFS, MEMBERS, INVITES & ACCESS REQUESTS
-- ============================================================
create table tournament_proofs (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  type          proof_type not null,
  url           text not null,
  note          text,
  created_at    timestamptz not null default now()
);

create index tournament_proofs_tournament_idx on tournament_proofs (tournament_id);

create table tournament_members (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  user_id       uuid not null references profiles (id) on delete cascade,
  role          tournament_role not null default 'editor',
  invited_by    uuid references profiles (id),
  created_at    timestamptz not null default now(),

  unique (tournament_id, user_id)
);

create index tournament_members_user_idx on tournament_members (user_id);

create or replace function add_owner_as_member()
returns trigger as $$
begin
  insert into tournament_members (tournament_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (tournament_id, user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger tournaments_owner_member
  after insert on tournaments
  for each row execute function add_owner_as_member();

create table tournament_invites (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  code          text not null unique,
  role          tournament_role not null default 'editor',
  created_by    uuid not null references profiles (id),
  expires_at    timestamptz,
  max_uses      int,
  uses          int not null default 0,
  revoked       boolean not null default false,
  created_at    timestamptz not null default now(),

  constraint invites_max_uses_sane check (max_uses is null or max_uses > 0),
  constraint invites_not_owner check (role <> 'owner')
);

create index tournament_invites_code_idx on tournament_invites (code);

create table tournament_access_requests (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  user_id        uuid not null references profiles (id) on delete cascade,
  message        text,
  role_requested tournament_role not null default 'editor',
  status         text not null default 'pending',
  decided_by     uuid references profiles (id),
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),

  constraint access_request_status_valid check (status in ('pending', 'approved', 'rejected')),
  constraint access_request_not_owner check (role_requested <> 'owner'),
  unique (tournament_id, user_id)
);

create index access_requests_tournament_idx on tournament_access_requests (tournament_id, status);

-- ============================================================
-- 7. VENUES & SUB-COMPETITIONS
-- ============================================================
create table venues (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name          text not null,
  address       text,
  city          text,
  capacity      int,
  created_at    timestamptz not null default now(),

  constraint venues_capacity_sane check (capacity is null or capacity between 0 and 500000)
);

create index venues_tournament_idx        on venues (tournament_id);
create unique index venues_unique_name    on venues (tournament_id, lower(name));

create table sub_competitions (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references tournaments (id) on delete cascade,
  name          text not null,
  kind          sub_competition_kind not null default 'group',
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index sub_competitions_tournament_idx  on sub_competitions (tournament_id, sort_order);
create unique index sub_competitions_unique_name on sub_competitions (tournament_id, lower(name));

-- ============================================================
-- 8. TOURNAMENT TEAMS, REGISTRATIONS & SUSPENSIONS
-- ============================================================
create table tournament_teams (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references tournaments (id) on delete cascade,
  club_id            uuid not null references clubs (id),
  sub_competition_id uuid references sub_competitions (id) on delete set null,
  group_name         text,
  home_color         text,
  away_color         text,
  attack_rating      numeric(4,1),
  defence_rating     numeric(4,1),
  created_at         timestamptz not null default now(),

  unique (tournament_id, club_id)
);

create index tournament_teams_tournament_idx on tournament_teams (tournament_id);

create table player_registrations (
  id                 uuid primary key default gen_random_uuid(),
  player_id          uuid not null references players (id),
  tournament_team_id uuid not null references tournament_teams (id) on delete cascade,
  jersey_number      int,
  position           text,
  created_at         timestamptz not null default now(),

  unique (player_id, tournament_team_id)
);

create index player_reg_player_idx on player_registrations (player_id);
create index player_reg_team_idx   on player_registrations (tournament_team_id);

create table suspensions (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid not null references tournaments (id) on delete cascade,
  tournament_team_id uuid not null references tournament_teams (id) on delete cascade,
  player_id          uuid not null references players (id) on delete cascade,
  matches            int not null default 1,
  start_date         date not null default current_date,
  reason             text,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),

  constraint suspensions_matches_sane check (matches between 1 and 50)
);

create index suspensions_tournament_idx on suspensions (tournament_id, active);
create index suspensions_player_idx     on suspensions (player_id);

-- ============================================================
-- 9. FIXTURES, LINEUPS & MATCH EVENTS
-- ============================================================
create table fixtures (
  id                      uuid primary key default gen_random_uuid(),
  tournament_id           uuid not null references tournaments (id) on delete cascade,
  round                   text,
  group_name              text,
  home_team_id            uuid not null references tournament_teams (id),
  away_team_id            uuid not null references tournament_teams (id),
  kickoff_at              timestamptz not null,
  venue                   text,
  venue_id                uuid references venues (id) on delete set null,
  status                  fixture_status not null default 'scheduled',
  home_score              int,
  away_score              int,
  ht_home_score           int,
  ht_away_score           int,
  home_formation          text,
  away_formation          text,
  official_motm_player_id uuid references players (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint fixtures_teams_differ check (home_team_id <> away_team_id),
  constraint fixtures_formation_sane check (
    (home_formation is null or home_formation ~ '^[0-9]([-]?[0-9]){1,4}$') and
    (away_formation is null or away_formation ~ '^[0-9]([-]?[0-9]){1,4}$')
  )
);

create index fixtures_tournament_idx    on fixtures (tournament_id);
create index fixtures_kickoff_idx       on fixtures (kickoff_at);
create index fixtures_status_idx        on fixtures (status);
create index fixtures_venue_idx         on fixtures (venue_id);
create index fixtures_official_motm_idx on fixtures (official_motm_player_id);

create trigger fixtures_updated_at before update on fixtures
  for each row execute function set_updated_at();

create table fixture_lineups (
  id                 uuid primary key default gen_random_uuid(),
  fixture_id         uuid not null references fixtures (id) on delete cascade,
  tournament_team_id uuid not null references tournament_teams (id) on delete cascade,
  player_id          uuid not null references players (id) on delete cascade,
  role               text not null default 'starter',
  shirt_number       int,
  position           text,
  created_by         uuid references profiles (id),
  created_at         timestamptz not null default now(),

  constraint fixture_lineups_role_valid check (role in ('starter', 'substitute')),
  constraint fixture_lineups_shirt_sane check (shirt_number is null or shirt_number between 1 and 99),
  unique (fixture_id, player_id)
);

create index fixture_lineups_fixture_idx on fixture_lineups (fixture_id);
create index fixture_lineups_team_idx    on fixture_lineups (fixture_id, tournament_team_id);
create index fixture_lineups_player_idx  on fixture_lineups (player_id);

create table match_events (
  id                 uuid primary key default gen_random_uuid(),
  fixture_id         uuid not null references fixtures (id) on delete cascade,
  tournament_team_id uuid not null references tournament_teams (id),
  player_id          uuid references players (id),
  related_player_id  uuid references players (id),
  type               event_type not null,
  minute             int,
  created_by         uuid references profiles (id),
  created_at         timestamptz not null default now()
);

create index match_events_fixture_idx on match_events (fixture_id);
create index match_events_player_idx  on match_events (player_id);
create index match_events_type_idx    on match_events (type);

-- ============================================================
-- 10. FROZEN TACTICA PREDICTIONS (BSD MATCHES)
-- ============================================================
create table match_predictions (
  event_id            bigint primary key,
  home_team           text not null,
  away_team           text not null,
  kickoff_at          timestamptz not null,
  home_attack         int,
  home_defence        int,
  away_attack         int,
  away_defence        int,
  home_win_prob       numeric,
  away_win_prob       numeric,
  draw_prob           numeric,
  home_best_formation text,
  away_best_formation text,
  payload             jsonb not null,
  formula_version     text not null,
  computed_at         timestamptz not null default now()
);

create index match_predictions_kickoff_idx on match_predictions (kickoff_at);

create or replace function match_predictions_block_update()
returns trigger as $$
begin
  raise exception 'match_predictions rows are frozen and cannot be updated';
end;
$$ language plpgsql;

create trigger match_predictions_no_update
  before update on match_predictions
  for each row execute function match_predictions_block_update();

-- ============================================================
-- 11. CROWD PLAYER RATINGS & MAN OF THE MATCH
-- ============================================================
create table player_ratings (
  id         uuid primary key default gen_random_uuid(),
  source     rating_source not null,
  match_ref  text not null,
  player_ref text not null,
  user_id    uuid not null references profiles (id) on delete cascade,
  score      numeric(3,1) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint player_ratings_score_range check (score >= 1.0 and score <= 10.0),
  constraint player_ratings_score_step  check ((score * 2) = floor(score * 2)),
  unique (source, match_ref, player_ref, user_id)
);

create index player_ratings_match_idx  on player_ratings (source, match_ref);
create index player_ratings_player_idx on player_ratings (source, player_ref);

create trigger player_ratings_updated_at before update on player_ratings
  for each row execute function set_updated_at();

create table motm_votes (
  id         uuid primary key default gen_random_uuid(),
  source     rating_source not null,
  match_ref  text not null,
  player_ref text not null,
  user_id    uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (source, match_ref, user_id)
);

create index motm_votes_match_idx on motm_votes (source, match_ref);

create trigger motm_votes_updated_at before update on motm_votes
  for each row execute function set_updated_at();

-- ============================================================
-- 12. MONETISATION (GRAPHICS SUBSCRIPTIONS & GENERATED ASSETS)
-- ============================================================
create table subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references profiles (id) on delete cascade,
  plan         plan_tier not null default 'free',
  image_quota  int not null default 10,
  images_used  int not null default 0,
  period_start timestamptz not null default now(),
  period_end   timestamptz,
  paystack_ref text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index subscriptions_user_idx on subscriptions (user_id);

create trigger subscriptions_updated_at before update on subscriptions
  for each row execute function set_updated_at();

create table generated_images (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles (id) on delete cascade,
  fixture_id uuid references fixtures (id) on delete set null,
  kind       text not null,
  image_url  text not null,
  created_at timestamptz not null default now()
);

create index generated_images_user_idx on generated_images (user_id);

-- ============================================================
-- 13. PUSH NOTIFICATIONS (DEVICE TOKENS & EVENT/REVERSAL LEDGER)
-- ============================================================
create table if not exists device_push_tokens (
  expo_push_token  text primary key,
  user_id          uuid references profiles (id) on delete cascade,
  platform         text not null default 'android',
  followed_teams   jsonb not null default '[]',
  followed_matches jsonb not null default '[]',
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists device_push_tokens_user_idx   on device_push_tokens (user_id);
create index if not exists device_push_tokens_active_idx on device_push_tokens (active);

drop trigger if exists device_push_tokens_updated_at on device_push_tokens;
create trigger device_push_tokens_updated_at before update on device_push_tokens
  for each row execute function set_updated_at();

create table if not exists dispatched_match_events (
  event_uid    text primary key,
  source       rating_source not null,
  match_ref    text not null,
  event_type   text not null,
  player_name  text,
  minute       int,
  payload      jsonb not null default '{}',
  is_cancelled boolean not null default false,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists dispatched_match_events_match_idx
  on dispatched_match_events (source, match_ref);
create index if not exists dispatched_match_events_active_idx
  on dispatched_match_events (source, match_ref, is_cancelled);

-- ============================================================
-- 14. LOCK DOWN ALL TABLES (RLS ON, NO PUBLIC POLICIES)
-- ============================================================
alter table profiles                   enable row level security;
alter table clubs                      enable row level security;
alter table players                    enable row level security;
alter table tournaments                enable row level security;
alter table tournament_proofs          enable row level security;
alter table tournament_members         enable row level security;
alter table tournament_invites         enable row level security;
alter table tournament_access_requests enable row level security;
alter table venues                     enable row level security;
alter table sub_competitions           enable row level security;
alter table tournament_teams           enable row level security;
alter table player_registrations       enable row level security;
alter table suspensions                enable row level security;
alter table fixtures                   enable row level security;
alter table fixture_lineups            enable row level security;
alter table match_events               enable row level security;
alter table match_predictions          enable row level security;
alter table player_ratings             enable row level security;
alter table motm_votes                 enable row level security;
alter table subscriptions              enable row level security;
alter table generated_images           enable row level security;
alter table device_push_tokens         enable row level security;
alter table dispatched_match_events    enable row level security;

-- ============================================================
-- 15. INITIAL ADMIN SETUP (RUN AFTER SIGNING UP)
-- ============================================================
update profiles
set    role = 'admin'
where  email = 'iamtjbest15@gmail.com';