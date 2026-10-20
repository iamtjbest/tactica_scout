-- tournaments_v4.sql
-- Run once in the Supabase SQL editor, after tournaments_v3.sql.
--
-- The three things the editor screens needed and the schema did not
-- carry: where matches are played, who is banned, and the named parts a
-- competition is actually divided into.

-- ============================================================
-- VENUES
-- Per competition, not global. The same pitch is "Main Bowl" to one
-- organiser and "ABU Sports Complex Pitch 1" to another, and a shared
-- table would have them renaming each other's grounds.
-- ============================================================
create table if not exists venues (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  name           text not null,
  address        text,
  city           text,
  capacity       int,
  created_at     timestamptz not null default now(),

  constraint venues_capacity_sane check (capacity is null or capacity between 0 and 500000)
);

create index if not exists venues_tournament_idx on venues (tournament_id);

-- One name per competition. Two "Main Bowl"s is a typo, and it makes
-- the fixture venue picker ambiguous.
create unique index if not exists venues_unique_name
  on venues (tournament_id, lower(name));

-- Fixtures keep their free-text venue column so nothing already entered
-- is lost. The new link is what the picker writes; the text is kept in
-- sync by the backend so every existing reader keeps working.
alter table fixtures
  add column if not exists venue_id uuid references venues (id) on delete set null;

create index if not exists fixtures_venue_idx on fixtures (venue_id);

-- ============================================================
-- SUB-COMPETITIONS
-- The named parts of a competition: "Group A", "Group B", "Knockout".
--
-- group_name on tournament_teams and fixtures is deliberately NOT
-- dropped. Standings, fixture generation and the public Scout endpoint
-- all read it, and rewriting those to join a new table would risk the
-- one thing that must not break. Instead the backend keeps group_name
-- equal to the sub-competition's name, so this table is the editable
-- record and group_name stays the working index.
-- ============================================================
do $$ begin
  create type sub_competition_kind as enum ('league', 'group', 'knockout', 'playoff');
exception when duplicate_object then null;
end $$;

create table if not exists sub_competitions (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  name           text not null,
  kind           sub_competition_kind not null default 'group',
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create index if not exists sub_competitions_tournament_idx
  on sub_competitions (tournament_id, sort_order);

create unique index if not exists sub_competitions_unique_name
  on sub_competitions (tournament_id, lower(name));

alter table tournament_teams
  add column if not exists sub_competition_id uuid
    references sub_competitions (id) on delete set null;

-- Backfill: every group that already exists as free text becomes a row,
-- and the teams in it are pointed at it. Existing competitions get the
-- new screen populated rather than looking empty.
-- The cast is required. A bare 'group' in a SELECT list resolves as
-- text, and Postgres will not coerce text to an enum implicitly. In the
-- column DEFAULT above it does coerce, which is why only this one needs
-- spelling out.
insert into sub_competitions (tournament_id, name, kind, sort_order)
select distinct tt.tournament_id, tt.group_name, 'group'::sub_competition_kind, 0
from tournament_teams tt
where tt.group_name is not null and tt.group_name <> ''
on conflict do nothing;

update tournament_teams tt
set sub_competition_id = sc.id
from sub_competitions sc
where sc.tournament_id = tt.tournament_id
  and lower(sc.name) = lower(tt.group_name)
  and tt.sub_competition_id is null;

-- ============================================================
-- SUSPENSIONS
-- A player banned for N matches. Kept as a record with a start date
-- rather than a countdown column, because a countdown has to be
-- decremented by something, and nothing reliably runs between matches.
-- ============================================================
create table if not exists suspensions (
  id                  uuid primary key default gen_random_uuid(),
  tournament_id       uuid not null references tournaments (id) on delete cascade,
  tournament_team_id  uuid not null references tournament_teams (id) on delete cascade,
  player_id           uuid not null references players (id) on delete cascade,

  matches             int not null default 1,
  start_date          date not null default current_date,
  reason              text,

  -- Set by the organiser when the ban is served or rescinded. Nothing
  -- expires it automatically.
  active              boolean not null default true,
  created_at          timestamptz not null default now(),

  constraint suspensions_matches_sane check (matches between 1 and 50)
);

create index if not exists suspensions_tournament_idx
  on suspensions (tournament_id, active);
create index if not exists suspensions_player_idx on suspensions (player_id);

-- Same lockdown as every other table: RLS on, no policies, reached only
-- by the backend's service role key.
alter table venues           enable row level security;
alter table sub_competitions enable row level security;
alter table suspensions      enable row level security;
