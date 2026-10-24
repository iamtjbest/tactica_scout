-- ratings_v1.sql
-- Run once in the Supabase SQL editor.
--
-- Crowd player ratings and Man of the Match voting, for BSD matches
-- (Man Utd, Bayern, anything the livescore carries) AND for local
-- tournaments run in the editor.
--
-- ── Why one table instead of one per source ─────────────────────────
-- BSD identifies a match and a player with integers; a local tournament
-- uses UUIDs. Two tables would mean two aggregation queries, two window
-- checks and two sets of endpoints, all identical, to save a text
-- column. So the source is a discriminator and the refs are text.
--
--   source      'bsd'   -> match_ref is the BSD event id
--                          player_ref is the BSD player id
--               'local' -> match_ref is fixtures.id
--                          player_ref is players.id
--
-- There is deliberately NO foreign key on the refs: half the rows point
-- at BSD, which is not in this database. The refs are validated by the
-- backend against whichever source they claim before the insert.

do $$ begin
  create type rating_source as enum ('bsd', 'local');
exception when duplicate_object then null;
end $$;

-- ============================================================
-- PLAYER RATINGS  (1.0 - 10.0, one per person per player per match)
-- ============================================================
create table if not exists player_ratings (
  id          uuid primary key default gen_random_uuid(),
  source      rating_source not null,
  match_ref   text not null,
  player_ref  text not null,
  user_id     uuid not null references profiles (id) on delete cascade,

  score       numeric(3,1) not null,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- FotMob-style range. Checked here as well as in the API so a bad
  -- client can't poison an average.
  constraint player_ratings_score_range check (score >= 1.0 and score <= 10.0),
  -- Halves only: 7.5 yes, 7.4 no. Keeps the distribution readable and
  -- stops anyone gaming an average with 6.01 precision.
  constraint player_ratings_score_step check ((score * 2) = floor(score * 2)),

  -- One vote per person per player per match. Changing your mind is an
  -- update of this row, never a second one, so there is never a question
  -- about which of two votes counts.
  unique (source, match_ref, player_ref, user_id)
);

create index if not exists player_ratings_match_idx
  on player_ratings (source, match_ref);
create index if not exists player_ratings_player_idx
  on player_ratings (source, player_ref);

-- ============================================================
-- MAN OF THE MATCH  (one vote per person per match, not per player)
-- ============================================================
create table if not exists motm_votes (
  id          uuid primary key default gen_random_uuid(),
  source      rating_source not null,
  match_ref   text not null,
  player_ref  text not null,
  user_id     uuid not null references profiles (id) on delete cascade,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- The uniqueness is on the MATCH, not the player: you get one shout
  -- per game. Switching your pick updates player_ref in place.
  unique (source, match_ref, user_id)
);

create index if not exists motm_votes_match_idx on motm_votes (source, match_ref);

-- Keep updated_at honest, since "changed their mind" is an update.
create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists player_ratings_touch on player_ratings;
create trigger player_ratings_touch before update on player_ratings
  for each row execute function touch_updated_at();

drop trigger if exists motm_votes_touch on motm_votes;
create trigger motm_votes_touch before update on motm_votes
  for each row execute function touch_updated_at();

-- Same lockdown as every other table: RLS on, no policies, reached only
-- by the backend's service role key.
alter table player_ratings enable row level security;
alter table motm_votes     enable row level security;
