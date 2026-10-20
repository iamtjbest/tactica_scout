-- tournaments_v2.sql
-- Run once in the Supabase SQL editor, after schema.sql.
--
-- Two changes from running the thing for real:
--
-- 1. A CONTACT EMAIL on the tournament. We had organizer_phone and a
--    second contact, but no email, and email is how we actually reach
--    an organiser about a review decision. Defaults to their account
--    email in the UI, but is its own field: the person who signed up
--    is not always the person to chase about a fixture.
--
-- 2. LEVEL VALUES THAT WORK OUTSIDE ONE UNIVERSITY. The original enum
--    was department / faculty / src / open, which only makes sense at
--    ABU. This is meant for anyone running a competition anywhere, so
--    the list has to describe competitions, not ABU's structure.
--
--    The old values are kept rather than dropped. Postgres cannot
--    remove an enum value without recreating the type and rewriting
--    every row that uses it, and existing tournaments reference them.
--    They simply stop being offered in the UI.

alter table tournaments
  add column if not exists contact_email text;

-- Backfill from the owner's account so no existing row is left with
-- nothing to contact.
update tournaments t
set    contact_email = p.email
from   profiles p
where  t.owner_id = p.id
  and  t.contact_email is null;

-- Broader levels. ADD VALUE IF NOT EXISTS is idempotent, so re-running
-- this file is harmless.
alter type tournament_level add value if not exists 'university';
alter type tournament_level add value if not exists 'school';
alter type tournament_level add value if not exists 'youth';
alter type tournament_level add value if not exists 'amateur';
alter type tournament_level add value if not exists 'semi_professional';
alter type tournament_level add value if not exists 'professional';
alter type tournament_level add value if not exists 'corporate';
alter type tournament_level add value if not exists 'community';
