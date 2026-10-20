-- tournament_members.sql
-- Run once in the Supabase SQL editor, after schema.sql.
--
-- Multi-editor access. One organiser cannot key in three concurrent
-- matches, and match commissioners radioing scores back to the owner
-- is not a system. They get access to the tournament directly.
--
-- Two roles, because that is the split that exists in practice:
--
--   owner   the organiser. The tournament itself -- teams, players,
--           fixtures, proof, people, submitting. Stays in
--           tournaments.owner_id; this table mirrors it so one query
--           answers "who can touch this".
--   editor  match details ONLY: scoreline, goalscorers, assists,
--           cards, substitutions. The match commissioner on pitch 2.
--           Cannot add or remove teams, change the fixture list, or
--           submit the tournament.
--
-- Access arrives two ways: an invite code the owner hands out, or a
-- request the owner approves. Both land in the same place.

create type tournament_role as enum ('owner', 'editor');

-- ============================================================
-- MEMBERS
-- ============================================================
create table tournament_members (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  user_id        uuid not null references profiles (id) on delete cascade,
  role           tournament_role not null default 'editor',
  invited_by     uuid references profiles (id),
  created_at     timestamptz not null default now(),

  -- One role per person per tournament. Changing someone's role is an
  -- update, never a second row, so there is never a question about
  -- which of two rows wins.
  unique (tournament_id, user_id)
);

create index tournament_members_user_idx on tournament_members (user_id);

-- ============================================================
-- INVITE CODES
-- The owner shares one of these. Short enough to read out loud at a
-- pitch, because that is how it will actually be delivered.
-- ============================================================
create table tournament_invites (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments (id) on delete cascade,
  code           text not null unique,
  role           tournament_role not null default 'editor',
  created_by     uuid not null references profiles (id),

  -- Both optional. A code with neither works until it is revoked,
  -- which is the right default for a weekend tournament.
  expires_at     timestamptz,
  max_uses       int,
  uses           int not null default 0,

  revoked        boolean not null default false,
  created_at     timestamptz not null default now(),

  constraint invites_max_uses_sane check (max_uses is null or max_uses > 0)
);

create index tournament_invites_code_idx on tournament_invites (code);

-- An invite can never grant ownership. Ownership transfer, if it ever
-- exists, will be its own deliberate action and not something that
-- falls out of a code someone forwarded.
alter table tournament_invites
  add constraint invites_not_owner check (role <> 'owner');

-- ============================================================
-- ACCESS REQUESTS
-- The other direction: someone finds the tournament and asks. Used
-- when the owner is not standing next to them.
-- ============================================================
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

  constraint access_request_status_valid
    check (status in ('pending', 'approved', 'rejected')),

  -- One request per person per tournament. Re-requesting after a
  -- rejection updates the existing row rather than letting someone
  -- spam the owner's inbox with new ones.
  unique (tournament_id, user_id)
);

create index access_requests_tournament_idx
  on tournament_access_requests (tournament_id, status);

alter table tournament_access_requests
  add constraint access_request_not_owner check (role_requested <> 'owner');

-- ============================================================
-- Backfill: every existing tournament's owner becomes a member row,
-- so the access check has a single table to read instead of special
-- casing the owner everywhere.
-- ============================================================
insert into tournament_members (tournament_id, user_id, role)
select id, owner_id, 'owner' from tournaments
on conflict (tournament_id, user_id) do nothing;

-- Keep it true for tournaments created from here on.
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

-- Same lockdown as every other table: RLS on, no policies, backend
-- only via the service role key.
alter table tournament_members         enable row level security;
alter table tournament_invites         enable row level security;
alter table tournament_access_requests enable row level security;
