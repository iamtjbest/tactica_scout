-- match_predictions.sql
-- Run once in the Supabase SQL editor (separate from schema.sql so you
-- don't re-run the whole schema).
--
-- One FROZEN Tactica prediction per match. The ratings and win
-- probabilities are written once, shortly before kickoff, and never
-- change after that: MUN vs TOT stays 56/58 and 40/42 no matter how
-- the two teams' form moves in later matches.
--
-- Keyed by the BSD event id, the same id the app already uses for
-- /api/matches/{event_id}.

create table match_predictions (
  event_id             bigint primary key,
  home_team            text        not null,
  away_team            text        not null,
  kickoff_at           timestamptz not null,

  home_attack          int,
  home_defence         int,
  away_attack          int,
  away_defence         int,
  home_win_prob        numeric,
  away_win_prob        numeric,
  draw_prob            numeric,
  home_best_formation  text,
  away_best_formation  text,

  -- Exactly what the Facts tab was served, so the stored row can be
  -- returned as-is and the response shape never drifts.
  payload              jsonb       not null,

  -- Bump this string in app/tactica.py if the rating formula or the
  -- model changes. Old rows keep the version that produced them.
  formula_version      text        not null,
  computed_at          timestamptz not null default now()
);

create index match_predictions_kickoff_idx on match_predictions (kickoff_at);

-- Immutability enforced by the database, not just by the backend code.
-- Any UPDATE is rejected, even from the service role key.
-- (DELETE is left open on purpose, so a bad snapshot can be removed by
-- hand in the SQL editor. The backend never deletes.)
create or replace function match_predictions_block_update()
returns trigger as $$
begin
  raise exception 'match_predictions rows are frozen and cannot be updated';
end;
$$ language plpgsql;

create trigger match_predictions_no_update
  before update on match_predictions
  for each row execute function match_predictions_block_update();

-- Same lockdown as every other Scout table: RLS on, no policies, only
-- the backend's service role key gets in.
alter table match_predictions enable row level security;
