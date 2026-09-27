-- Prep Kitchen database setup.
-- Run once in Supabase: SQL Editor -> New query -> paste this -> Run.
-- Safe to run again; it only creates what is missing.

-- Every saved thing (pantry item, recipe, prep, calendar meal, shopping item, food)
-- is one row, owned by the person who created it.
create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);

-- Row-level security: each signed-in person can only see and change their own rows.
alter table public.items enable row level security;

drop policy if exists "Users read own items"   on public.items;
drop policy if exists "Users insert own items" on public.items;
drop policy if exists "Users update own items" on public.items;
drop policy if exists "Users delete own items" on public.items;

create policy "Users read own items" on public.items
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users insert own items" on public.items
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Users update own items" on public.items
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users delete own items" on public.items
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Signed-out visitors get nothing; signed-in people get only what the policies allow.
revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;

-- Keep updated_at current.
create or replace function public.items_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row execute function public.items_touch_updated_at();
