-- P7 migration: guest list changes. Paste into Supabase SQL Editor and run once.
-- Additive only: the demo-v1 code keeps working against this schema.

alter table attendees
  add column if not exists note text,
  add column if not exists revoked_at timestamptz,
  add column if not exists added_via text not null default 'seed';   -- 'seed' | 'manual' | 'llm'

create table if not exists guest_changes (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  attendee_id uuid references attendees(id) on delete set null,
  op text not null,                 -- 'ADD' | 'REMOVE' | 'UPDATE_NOTE'
  detail jsonb,                     -- e.g. { name, note, previous_note }
  source_label text,                -- which message it came from, if LLM
  source_quote text,                -- short excerpt the change was based on, if LLM
  via text not null,                -- 'manual' | 'llm'
  applied_at timestamptz not null default now()
);

-- Same policy as the other tables: service role only.
alter table guest_changes enable row level security;
