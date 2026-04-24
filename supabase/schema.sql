create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  auth_email text unique,
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

create table if not exists public.question_templates (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  questions jsonb not null default '[]',
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  id text primary key,
  settings jsonb not null default '{}',
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

insert into public.app_settings (id, settings)
values ('scout_form', '{}')
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.questions enable row level security;
alter table public.question_templates enable row level security;
alter table public.app_settings enable row level security;
alter table public.submissions enable row level security;

alter table public.submissions add column if not exists starting_location text;
alter table public.submissions add column if not exists preload_fuel text;
alter table public.question_templates add column if not exists settings jsonb not null default '{}';
alter table public.profiles add column if not exists auth_email text;

update public.profiles
set auth_email = coalesce(auth_email, username || '@3181scouting.app')
where auth_email is null;

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

create or replace function public.get_auth_email_for_username(input_username text)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select auth_email
  from public.profiles
  where username = lower(trim(input_username))
  limit 1;
$$;

grant execute on function public.get_auth_email_for_username(text) to anon, authenticated;

create or replace function public.submit_scouting_submission(
  p_event_code text,
  p_match_number text,
  p_team_number text,
  p_scout_name text,
  p_scout_email text,
  p_scout_uid uuid,
  p_alliance text,
  p_station text,
  p_starting_location text,
  p_notes text,
  p_answers jsonb,
  p_device_created_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  if auth.uid() <> p_scout_uid then
    raise exception 'Scout uid does not match signed-in user';
  end if;

  insert into public.submissions (
    event_code,
    match_number,
    team_number,
    scout_name,
    scout_email,
    scout_uid,
    alliance,
    station,
    starting_location,
    notes,
    answers,
    device_created_at
  ) values (
    p_event_code,
    p_match_number,
    p_team_number,
    p_scout_name,
    p_scout_email,
    p_scout_uid,
    p_alliance,
    p_station,
    p_starting_location,
    p_notes,
    coalesce(p_answers, '{}'::jsonb),
    p_device_created_at
  )
  returning id into inserted_id;

  return inserted_id;
end;
$$;

grant execute on function public.submit_scouting_submission(
  text, text, text, text, text, uuid, text, text, text, text, jsonb, timestamptz
) to authenticated;

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

drop policy if exists "Admins can read templates" on public.question_templates;
create policy "Admins can read templates"
on public.question_templates for select
to authenticated
using (public.is_admin());

drop policy if exists "Admins can manage templates" on public.question_templates;
create policy "Admins can manage templates"
on public.question_templates for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Anyone signed in can read app settings" on public.app_settings;
create policy "Anyone signed in can read app settings"
on public.app_settings for select
to authenticated
using (true);

drop policy if exists "Admins can manage app settings" on public.app_settings;
create policy "Admins can manage app settings"
on public.app_settings for all
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
create unique index if not exists profiles_auth_email_idx on public.profiles (auth_email) where auth_email is not null;
create index if not exists submissions_created_at_idx on public.submissions (created_at desc);
create index if not exists questions_order_idx on public.questions (question_order);
create index if not exists question_templates_name_idx on public.question_templates (name);
