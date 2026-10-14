-- Smart Rollcall schema. Paste into Supabase SQL Editor and run.

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue text,
  starts_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists attendees (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  email text,
  ticket_type text default 'General',
  created_at timestamptz not null default now()
);

create table if not exists checkins (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendee_id uuid not null references attendees(id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  unique (event_id, attendee_id)
);

create table if not exists scan_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid,
  attendee_id uuid,
  result text not null,
  scanned_at timestamptz not null default now()
);

-- All access goes through server routes using the service role key.
-- Enable RLS with no policies so the anon key cannot read or write directly.
alter table events enable row level security;
alter table attendees enable row level security;
alter table checkins enable row level security;
alter table scan_log enable row level security;
