-- tournaments_v5.sql
-- Run once in the Supabase SQL editor, after tournaments_v4.sql.
--
-- Optional seed ratings used by local match predictions. Null keeps the
-- existing default rating; supplied ratings must remain in the editor's
-- 40-90 range.

alter table tournament_teams
  add column if not exists attack_rating numeric,
  add column if not exists defence_rating numeric;

alter table tournament_teams
  drop constraint if exists tournament_teams_ratings_sane;

alter table tournament_teams
  add constraint tournament_teams_ratings_sane check (
    (attack_rating is null or attack_rating between 40 and 90) and
    (defence_rating is null or defence_rating between 40 and 90)
  );
