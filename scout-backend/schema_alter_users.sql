-- Only run this if you ALREADY ran scout_schema.sql before I added
-- followed_teams and language to the users table. If you haven't run
-- the schema yet, ignore this file — the updated schema includes them.

alter table users
  add column if not exists followed_teams jsonb not null default '[]',
  add column if not exists language       text  not null default 'en';
