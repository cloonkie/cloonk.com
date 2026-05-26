supasbacreate table if not exists public.door_tracker_state (
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

alter table public.door_tracker_state enable row level security;
alter table public.door_tracker_restore_points enable row level security;

drop policy if exists "door tracker anon read state" on public.door_tracker_state;
drop policy if exists "door tracker anon write state" on public.door_tracker_state;
drop policy if exists "door tracker anon read restore points" on public.door_tracker_restore_points;
drop policy if exists "door tracker anon write restore points" on public.door_tracker_restore_points;

create policy "door tracker anon read state"
on public.door_tracker_state
for select
to anon
using (true);

create policy "door tracker anon write state"
on public.door_tracker_state
for all
to anon
using (true)
with check (true);

create policy "door tracker anon read restore points"
on public.door_tracker_restore_points
for select
to anon
using (true);

create policy "door tracker anon write restore points"
on public.door_tracker_restore_points
for all
to anon
using (true)
with check (true);
