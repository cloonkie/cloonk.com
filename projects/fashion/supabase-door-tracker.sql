create table if not exists public.door_tracker_allowed_users (
  email text primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.door_tracker_state (
  key text primary key,
  mode text not null default 'user',
  payload jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_by text
);

create table if not exists public.door_tracker_restore_points (
  id text primary key,
  mode text not null default 'user',
  label text not null default 'Snapshot',
  auto boolean not null default false,
  payload jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  updated_by text
);

alter table public.door_tracker_allowed_users enable row level security;
alter table public.door_tracker_state enable row level security;
alter table public.door_tracker_restore_points enable row level security;

drop policy if exists "door tracker anon read state" on public.door_tracker_state;
drop policy if exists "door tracker anon write state" on public.door_tracker_state;
drop policy if exists "door tracker anon read restore points" on public.door_tracker_restore_points;
drop policy if exists "door tracker anon write restore points" on public.door_tracker_restore_points;
drop policy if exists "door tracker roster users can read themselves" on public.door_tracker_allowed_users;
drop policy if exists "door tracker roster can read state" on public.door_tracker_state;
drop policy if exists "door tracker roster can write state" on public.door_tracker_state;
drop policy if exists "door tracker roster can read restore points" on public.door_tracker_restore_points;
drop policy if exists "door tracker roster can write restore points" on public.door_tracker_restore_points;

create policy "door tracker roster users can read themselves"
on public.door_tracker_allowed_users
for select
to authenticated
using (email = lower(auth.jwt() ->> 'email'));

create policy "door tracker roster can read state"
on public.door_tracker_state
for select
to authenticated
using (
  exists (
    select 1
    from public.door_tracker_allowed_users u
    where u.email = lower(auth.jwt() ->> 'email')
  )
);

create policy "door tracker roster can write state"
on public.door_tracker_state
for all
to authenticated
using (
  exists (
    select 1
    from public.door_tracker_allowed_users u
    where u.email = lower(auth.jwt() ->> 'email')
  )
)
with check (
  exists (
    select 1
    from public.door_tracker_allowed_users u
    where u.email = lower(auth.jwt() ->> 'email')
  )
);

create policy "door tracker roster can read restore points"
on public.door_tracker_restore_points
for select
to authenticated
using (
  exists (
    select 1
    from public.door_tracker_allowed_users u
    where u.email = lower(auth.jwt() ->> 'email')
  )
);

create policy "door tracker roster can write restore points"
on public.door_tracker_restore_points
for all
to authenticated
using (
  exists (
    select 1
    from public.door_tracker_allowed_users u
    where u.email = lower(auth.jwt() ->> 'email')
  )
)
with check (
  exists (
    select 1
    from public.door_tracker_allowed_users u
    where u.email = lower(auth.jwt() ->> 'email')
  )
);

-- Add each allowed editor here, or insert them in Supabase Table Editor.
-- These emails must also exist as Supabase Auth users.
-- insert into public.door_tracker_allowed_users (email, display_name)
-- values
--   ('kevin@example.com', 'Kevin')
-- on conflict (email) do update set display_name = excluded.display_name;
