-- tournaments_v3.sql
-- Run once in the Supabase SQL editor.
--
-- Two things the editor needs and the table doesn't carry yet:
--
--   points_rules  Torneo lets an organiser set what a win is worth.
--                 Three points for a win is near-universal now, but it
--                 is not universal: plenty of school and five-a-side
--                 competitions run 2-1-0, and some award a point for a
--                 losing bonus. Hard-coding 3/1/0 in the standings
--                 calculation makes those competitions unusable.
--
--   crest_url     The competition's own logo, shown next to its name in
--                 the editor and in Scout. Clubs already have one; the
--                 competition itself did not.
--
-- Both are additive and safe to run on a live table. Existing rows get
-- the defaults, which are what they were already being calculated with.

alter table tournaments
  add column if not exists points_rules jsonb
    not null default '{"win": 3, "draw": 1, "loss": 0}'::jsonb;

alter table tournaments
  add column if not exists crest_url text;

-- Keep the values sane. A negative points award, or a draw worth more
-- than a win, is a typo rather than an intention, and it would quietly
-- produce a nonsense table that nobody could explain.
alter table tournaments
  drop constraint if exists tournaments_points_rules_sane;

alter table tournaments
  add constraint tournaments_points_rules_sane check (
    (points_rules->>'win')::int  between 0 and 10 and
    (points_rules->>'draw')::int between 0 and 10 and
    (points_rules->>'loss')::int between 0 and 10 and
    (points_rules->>'win')::int >= (points_rules->>'draw')::int and
    (points_rules->>'draw')::int >= (points_rules->>'loss')::int
  );
