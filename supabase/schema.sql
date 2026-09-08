-- ============================================================================
-- Habit tracker schema
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.
-- Everything is scoped to auth.users via user_id and enforced with RLS, so a
-- signed-in client using the anon key can only ever touch its own rows.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- habits
-- ---------------------------------------------------------------------------
create table if not exists public.habits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  created_at  timestamptz not null default now(),
  archived_at timestamptz,

  constraint habits_name_not_blank check (char_length(btrim(name)) between 1 and 80)
);

comment on table public.habits is 'A recurring thing a user wants to do every day.';
comment on column public.habits.archived_at is 'Set to hide a habit from the app while keeping its history; queries filter on it being null.';

create index if not exists habits_user_id_created_at_idx
  on public.habits (user_id, created_at);

-- ---------------------------------------------------------------------------
-- habit_completions
-- One row per habit per day. The unique constraint makes "mark done" idempotent
-- and keeps a streak from being inflated by double taps.
-- ---------------------------------------------------------------------------
create table if not exists public.habit_completions (
  id           uuid primary key default gen_random_uuid(),
  habit_id     uuid not null references public.habits (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  completed_on date not null,
  created_at   timestamptz not null default now(),

  constraint habit_completions_one_per_day unique (habit_id, completed_on)
);

comment on table public.habit_completions is 'One row per habit per calendar day it was completed.';
comment on column public.habit_completions.completed_on is 'The user''s local calendar date, not a UTC timestamp.';

-- user_id is denormalised from habits so RLS can filter without a join.
create index if not exists habit_completions_user_id_completed_on_idx
  on public.habit_completions (user_id, completed_on desc);

create index if not exists habit_completions_habit_id_completed_on_idx
  on public.habit_completions (habit_id, completed_on desc);

-- ---------------------------------------------------------------------------
-- Keep habit_completions.user_id honest: it must always match the owner of the
-- habit, whatever the client sends.
-- ---------------------------------------------------------------------------
create or replace function public.set_completion_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select h.user_id into owner from public.habits h where h.id = new.habit_id;

  if owner is null then
    raise exception 'habit % does not exist', new.habit_id;
  end if;

  new.user_id := owner;
  return new;
end;
$$;

drop trigger if exists habit_completions_set_user_id on public.habit_completions;
create trigger habit_completions_set_user_id
  before insert or update on public.habit_completions
  for each row execute function public.set_completion_user_id();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
alter table public.habits enable row level security;
alter table public.habit_completions enable row level security;

-- A stock Supabase project already grants these through its default privileges
-- on the public schema, but spelling them out keeps this script self-contained:
-- without them a signed-in user hits "permission denied for table habits"
-- before RLS ever gets a say. anon is deliberately left out -- there are no
-- policies for it, so it can reach nothing here.
grant select, insert, update, delete on public.habits            to authenticated;
grant select, insert, update, delete on public.habit_completions to authenticated;

drop policy if exists "habits are readable by their owner"    on public.habits;
drop policy if exists "habits are insertable by their owner"  on public.habits;
drop policy if exists "habits are updatable by their owner"   on public.habits;
drop policy if exists "habits are deletable by their owner"   on public.habits;

create policy "habits are readable by their owner"
  on public.habits for select
  to authenticated
  using (auth.uid() = user_id);

create policy "habits are insertable by their owner"
  on public.habits for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "habits are updatable by their owner"
  on public.habits for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "habits are deletable by their owner"
  on public.habits for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "completions are readable by their owner"   on public.habit_completions;
drop policy if exists "completions are insertable by their owner" on public.habit_completions;
drop policy if exists "completions are deletable by their owner"  on public.habit_completions;

create policy "completions are readable by their owner"
  on public.habit_completions for select
  to authenticated
  using (auth.uid() = user_id);

-- The habit must belong to the caller. The trigger above then overwrites
-- user_id with the habit's real owner, so a forged user_id cannot get through.
create policy "completions are insertable by their owner"
  on public.habit_completions for insert
  to authenticated
  with check (
    exists (
      select 1 from public.habits h
      where h.id = habit_id and h.user_id = auth.uid()
    )
  );

create policy "completions are deletable by their owner"
  on public.habit_completions for delete
  to authenticated
  using (auth.uid() = user_id);
