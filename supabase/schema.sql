create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.questions (
  id text primary key,
  label text not null,
  type text not null check (type in ('counter', 'number', 'select', 'toggle', 'text')),
  phase text not null check (phase in ('auto', 'teleop', 'endgame', 'overall')),
  question_order integer not null default 0,
  required boolean not null default false,
  options text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  match_number text not null,
  team_number text not null,
  scout_name text not null,
  scout_email text not null,
  scout_uid uuid not null references auth.users(id) on delete cascade,
  alliance text not null,
  station text not null,
  starting_location text,
  preload_fuel text,
  notes text,
  answers jsonb not null default '{}',
  created_at timestamptz not null default now(),
  device_created_at timestamptz
);

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.submissions enable row level security;

alter table public.submissions add column if not exists starting_location text;
alter table public.submissions add column if not exists preload_fuel text;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and is_admin = true
  );
$$;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Admins can read profiles" on public.profiles;
create policy "Admins can read profiles"
on public.profiles for select
to authenticated
using (public.is_admin());

drop policy if exists "Anyone signed in can read questions" on public.questions;
create policy "Anyone signed in can read questions"
on public.questions for select
to authenticated
using (true);

drop policy if exists "Admins can manage questions" on public.questions;
create policy "Admins can manage questions"
on public.questions for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can create own submissions" on public.submissions;
create policy "Users can create own submissions"
on public.submissions for insert
to authenticated
with check ((select auth.uid()) = scout_uid);

drop policy if exists "Admins can read submissions" on public.submissions;
create policy "Admins can read submissions"
on public.submissions for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can delete submissions" on public.submissions;
create policy "Admins can delete submissions"
on public.submissions for delete
to authenticated
using (public.is_admin());

create index if not exists profiles_username_idx on public.profiles (username);
create index if not exists submissions_created_at_idx on public.submissions (created_at desc);
create index if not exists questions_order_idx on public.questions (question_order);
