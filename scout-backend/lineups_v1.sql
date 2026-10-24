-- lineups_v1.sql
-- Run once in the Supabase SQL editor, after ratings_v1.sql.
--
-- Who actually played in a local fixture.
--
-- Until now the schema knew who was REGISTERED to a team for the whole
-- competition (player_registrations) but never who took the field in a
-- given match. That gap is why ratings for a local match had to be
-- built from whoever happened to get a goal or a card logged against
-- them: a player could have the game of his life, touch nothing the
-- organiser recorded, and be unratable.
--
-- One row per player per fixture. The organiser enters the XI and the
-- bench from the editor once the competition is approved.

create table if not exists fixture_lineups (
  id                  uuid primary key default gen_random_uuid(),
  fixture_id          uuid not null references fixtures (id) on delete cascade,
  tournament_team_id  uuid not null references tournament_teams (id) on delete cascade,
  player_id           uuid not null references players (id) on delete cascade,

  -- 'starter' or 'substitute'. A substitute who comes on is still a
  -- substitute here; the substitution itself is a match_event, and
  -- conflating the two would lose the distinction between "named on the
  -- bench" and "actually came on".
  role                text not null default 'starter',

  -- Copied from the registration at the time the sheet is entered
  -- rather than joined. A squad number can change between matches, and
  -- the team sheet should record what was on the shirt that day.
  shirt_number        int,
  position            text,

  created_by          uuid references profiles (id),
  created_at          timestamptz not null default now(),

  constraint fixture_lineups_role_valid check (role in ('starter', 'substitute')),
  constraint fixture_lineups_shirt_sane
    check (shirt_number is null or shirt_number between 1 and 99),

  -- A player appears once per fixture. He cannot be in the XI and on
  -- the bench at the same time, and a double entry would be counted
  -- twice everywhere downstream.
  unique (fixture_id, player_id)
);

create index if not exists fixture_lineups_fixture_idx
  on fixture_lineups (fixture_id);
create index if not exists fixture_lineups_team_idx
  on fixture_lineups (fixture_id, tournament_team_id);
create index if not exists fixture_lineups_player_idx
  on fixture_lineups (player_id);

-- Formation label per side, so the pitch graphic can be laid out the
-- same way a BSD lineup is. Nullable: an organiser who just lists
-- eleven names without a shape still gets a working team sheet, and the
-- renderer falls back to position buckets.
alter table fixtures
  add column if not exists home_formation text;
alter table fixtures
  add column if not exists away_formation text;

alter table fixtures
  drop constraint if exists fixtures_formation_sane;
alter table fixtures
  add constraint fixtures_formation_sane check (
    (home_formation is null or home_formation ~ '^[0-9]([-]?[0-9]){1,4}$') and
    (away_formation is null or away_formation ~ '^[0-9]([-]?[0-9]){1,4}$')
  );

-- Same lockdown as every other table: RLS on, no policies, reached only
-- by the backend's service role key.
alter table fixture_lineups enable row level security;
