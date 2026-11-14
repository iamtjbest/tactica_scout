-- tournaments_v6.sql
-- Run once in the Supabase SQL editor, after tournaments_v5.sql.

alter type event_type add value if not exists 'penalty_saved';

alter table fixtures
  add column if not exists official_motm_player_id uuid references players (id) on delete set null;

create index if not exists fixtures_official_motm_idx
  on fixtures (official_motm_player_id);