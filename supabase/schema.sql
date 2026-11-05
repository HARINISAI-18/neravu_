-- Run in Supabase Dashboard > SQL Editor.
-- Passwords are managed by Supabase Auth and must never be copied into these tables.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  progress_consent_at timestamptz,
  progress_consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_progress (
  user_id uuid primary key references auth.users (id) on delete cascade,
  progress jsonb not null default '{}'::jsonb
    check (jsonb_typeof(progress) = 'object'),
  updated_at timestamptz not null default now()
);

grant usage on schema public to authenticated;

comment on table public.patient_progress is
  'Contains user-provided patient assistance assessment data. Treat as sensitive health information.';
comment on column public.patient_progress.progress is
  'Versioned JSON payload. Do not store passwords, access tokens, or chat transcripts here.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists patient_progress_set_updated_at on public.patient_progress;
create trigger patient_progress_set_updated_at
before update on public.patient_progress
for each row execute function public.set_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.patient_progress enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;

drop policy if exists "Users can read their own progress" on public.patient_progress;
create policy "Users can read their own progress"
on public.patient_progress for select
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.progress_consent_at is not null
      and profile.progress_consent_version = '2026-11-v1'
  )
);

drop policy if exists "Users can create their own progress" on public.patient_progress;
create policy "Users can create their own progress"
on public.patient_progress for insert
to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.progress_consent_at is not null
      and profile.progress_consent_version = '2026-11-v1'
  )
);

drop policy if exists "Users can update their own progress" on public.patient_progress;
create policy "Users can update their own progress"
on public.patient_progress for update
to authenticated
using (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.progress_consent_at is not null
      and profile.progress_consent_version = '2026-11-v1'
  )
)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.profiles as profile
    where profile.id = (select auth.uid())
      and profile.progress_consent_at is not null
      and profile.progress_consent_version = '2026-11-v1'
  )
);

drop policy if exists "Users can delete their own progress" on public.patient_progress;
create policy "Users can delete their own progress"
on public.patient_progress for delete
to authenticated
using ((select auth.uid()) = user_id);

grant select, update on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant select, insert, update, delete on public.patient_progress to authenticated;
revoke all on public.profiles from anon;
revoke all on public.patient_progress from anon;

-- Backfill profiles for Auth users that existed before this migration.
insert into public.profiles (id, display_name)
select
  users.id,
  coalesce(users.raw_user_meta_data ->> 'display_name', '')
from auth.users as users
on conflict (id) do nothing;

create or replace function public.grant_progress_consent()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  update public.profiles
  set progress_consent_at = now(),
      progress_consent_version = '2026-11-v1'
  where id = (select auth.uid());
end;
$$;

revoke all on function public.grant_progress_consent() from public, anon;
grant execute on function public.grant_progress_consent() to authenticated;
