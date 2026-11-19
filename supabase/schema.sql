-- Prep Kitchen database setup.
-- Run in Supabase: SQL Editor -> New query -> paste this whole file -> Run.
-- Safe to run again; it only creates or updates what is missing and keeps all saved data.
-- Only touches Prep Kitchen's own objects (items, households, household_members, pk_* functions).

-- ===================================================================================
-- Kitchens
-- Every person has a private kitchen, and can also belong to one shared household.
-- Each saved thing (pantry item, recipe, prep, calendar meal, shopping item, food) is
-- one row in public.items, stored in a "space":
--   private row:   space_id = the person's user id, user_id = the person's user id
--   household row: space_id = the household id,    user_id = null (it belongs to everyone in it)
-- Personal settings (appearance, nutrition goals) always stay private.
-- ===================================================================================

create table if not exists public.households (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null default 'Our kitchen' check (char_length(name) between 1 and 60),
  invite_code text        not null unique,
  created_by  uuid        references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- A person belongs to at most one household (user_id is the primary key).
create table if not exists public.household_members (
  user_id      uuid        primary key references auth.users (id) on delete cascade,
  household_id uuid        not null references public.households (id) on delete cascade,
  email        text,
  joined_at    timestamptz not null default now()
);
create index if not exists household_members_household_idx on public.household_members (household_id);

create table if not exists public.items (
  space_id   uuid        not null default auth.uid(),
  user_id    uuid        default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  id         text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (space_id, collection, id)
);

-- Upgrade an items table from the first version (private kitchens only, keyed by user_id).
-- Existing rows become their owner's private kitchen. Nothing is deleted.
alter table public.items add column if not exists space_id uuid;
update public.items set space_id = user_id where space_id is null;
alter table public.items alter column space_id set not null;
alter table public.items alter column space_id set default auth.uid();

-- Private rows stay unique per person. This also keeps copies of the app from before
-- households working (they save with "on conflict (user_id, collection, id)").
create unique index if not exists items_owner_key on public.items (user_id, collection, id);

do $$
declare pk record;
begin
  select conname, pg_get_constraintdef(oid) as def into pk
    from pg_constraint where conrelid = 'public.items'::regclass and contype = 'p';
  if pk.def is distinct from 'PRIMARY KEY (space_id, collection, id)' then
    if pk.conname is not null then
      execute format('alter table public.items drop constraint %I', pk.conname);
    end if;
    alter table public.items add constraint items_pkey primary key (space_id, collection, id);
  end if;
end $$;

-- Household rows have no single owner.
alter table public.items alter column user_id drop not null;

-- ===================================================================================
-- Helper used by the security rules
-- ===================================================================================

-- The signed-in person's household, or null. Security definer so the rules below can
-- look it up without recursing into household_members' own rules.
create or replace function public.pk_my_household()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.household_members where user_id = auth.uid();
$$;

-- ===================================================================================
-- Row-level security
-- ===================================================================================

alter table public.items             enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;

-- Rules from the first version.
drop policy if exists "Users read own items"   on public.items;
drop policy if exists "Users insert own items" on public.items;
drop policy if exists "Users update own items" on public.items;
drop policy if exists "Users delete own items" on public.items;

drop policy if exists "Kitchen members read items"   on public.items;
drop policy if exists "Kitchen members insert items" on public.items;
drop policy if exists "Kitchen members update items" on public.items;
drop policy if exists "Kitchen members delete items" on public.items;

-- See and delete: rows in your private kitchen or in your household's kitchen.
create policy "Kitchen members read items" on public.items
  for select to authenticated
  using (space_id = (select auth.uid()) or space_id = (select public.pk_my_household()));

create policy "Kitchen members delete items" on public.items
  for delete to authenticated
  using (space_id = (select auth.uid()) or space_id = (select public.pk_my_household()));

-- Add and change: a private row must be yours; a household row must be in your household,
-- have no owner, and can't be a settings row (settings stay private).
create policy "Kitchen members insert items" on public.items
  for insert to authenticated
  with check (
    (space_id = (select auth.uid()) and user_id = (select auth.uid()))
    or (space_id = (select public.pk_my_household()) and user_id is null and collection <> 'settings')
  );

create policy "Kitchen members update items" on public.items
  for update to authenticated
  using (space_id = (select auth.uid()) or space_id = (select public.pk_my_household()))
  with check (
    (space_id = (select auth.uid()) and user_id = (select auth.uid()))
    or (space_id = (select public.pk_my_household()) and user_id is null and collection <> 'settings')
  );

-- Households: members see their own household and its members, and can rename it.
-- Creating, joining, leaving, removing someone and new invite codes go through the functions below.
drop policy if exists "Members read their household"   on public.households;
drop policy if exists "Members rename their household" on public.households;
create policy "Members read their household" on public.households
  for select to authenticated using (id = (select public.pk_my_household()));
create policy "Members rename their household" on public.households
  for update to authenticated
  using (id = (select public.pk_my_household()))
  with check (id = (select public.pk_my_household()));

drop policy if exists "Members see each other" on public.household_members;
create policy "Members see each other" on public.household_members
  for select to authenticated using (household_id = (select public.pk_my_household()));

-- Signed-out visitors get nothing; signed-in people get only what the rules allow.
revoke all on public.items, public.households, public.household_members from anon;
revoke all on public.households, public.household_members from authenticated;
grant select, insert, update, delete on public.items to authenticated;
grant select on public.households, public.household_members to authenticated;
grant update (name) on public.households to authenticated;

-- ===================================================================================
-- Household actions (called from the app with supabase.rpc)
-- ===================================================================================

-- A fresh invite code like 'K7QH-2MXP-9C': 10 characters from 32 easy-to-read ones (50 random bits).
-- The random bytes come from gen_random_uuid(), skipping byte 6, whose low 5 bits aren't all random.
create or replace function public.pk_new_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  b bytea := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
  pick constant int[] := array[0, 1, 2, 3, 4, 5, 7, 9, 10, 11];
  i int;
  s text := '';
begin
  foreach i in array pick loop
    s := s || substr(alphabet, 1 + (get_byte(b, i) % 32), 1);
  end loop;
  return substr(s, 1, 4) || '-' || substr(s, 5, 4) || '-' || substr(s, 9, 2);
end;
$$;

-- Turns whatever someone typed or pasted (spaces, lower case, missing dashes, a whole link) into a code.
create or replace function public.pk_clean_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when char_length(c) = 10 then substr(c, 1, 4) || '-' || substr(c, 5, 4) || '-' || substr(c, 9, 2) else c end
  from (select regexp_replace(upper(regexp_replace(coalesce(p_code, ''), '^.*[?&]join=', '')), '[^0-9A-Z]', '', 'g') as c) x;
$$;

-- Create a household and move your kitchen into it: your pantry, recipes, preps, calendar,
-- grocery list and saved foods become shared. Your personal settings stay private.
create or replace function public.pk_create_household(p_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hh uuid;
  code text;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.household_members where user_id = me) then
    raise exception 'You are already in a household. Leave it first.';
  end if;
  loop
    code := public.pk_new_code();
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  insert into public.households (name, invite_code, created_by)
    values (coalesce(nullif(left(trim(p_name), 60), ''), 'Our kitchen'), code, me)
    returning id into hh;
  insert into public.household_members (user_id, household_id, email)
    values (me, hh, (select email from auth.users where id = me));
  update public.items set space_id = hh, user_id = null
    where space_id = me and collection <> 'settings';
  return hh;
end;
$$;

-- What an invite code points to, so the app can ask "Join The Smiths' kitchen (2 people)?"
create or replace function public.pk_peek_household(p_code text)
returns table (name text, members int)
language sql
stable
security definer
set search_path = ''
as $$
  select h.name, (select count(*)::int from public.household_members m where m.household_id = h.id)
  from public.households h
  where auth.uid() is not null and h.invite_code = public.pk_clean_code(p_code);
$$;

-- Join with an invite code. Your private kitchen is kept exactly as it is, set aside while you
-- are in the household, and comes back if you leave. With p_bring_recipes, your recipes and
-- saved foods are also copied into the shared collection (one already there with the same ID wins).
create or replace function public.pk_join_household(p_code text, p_bring_recipes boolean default true)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hh uuid;
  current_hh uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select id into hh from public.households where invite_code = public.pk_clean_code(p_code);
  if hh is null then raise exception 'That invite code doesn''t match a household. Check it and try again.'; end if;
  select household_id into current_hh from public.household_members where user_id = me;
  if current_hh = hh then return hh; end if;
  if current_hh is not null then raise exception 'You are already in a household. Leave it first.'; end if;
  if (select count(*) from public.household_members where household_id = hh) >= 12 then
    raise exception 'That household is full (12 people).';
  end if;
  insert into public.household_members (user_id, household_id, email)
    values (me, hh, (select email from auth.users where id = me));
  if p_bring_recipes then
    insert into public.items (space_id, user_id, collection, id, data)
      select hh, null, collection, id, data from public.items
      where space_id = me and collection in ('recipes', 'foods')
      on conflict (space_id, collection, id) do nothing;
  end if;
  return hh;
end;
$$;

-- Leave your household and go back to your private kitchen. With p_take_copy, everything in the
-- shared kitchen is first copied into your private kitchen (your own item wins on the same ID).
-- When the last person leaves, the household and its shared kitchen are deleted.
create or replace function public.pk_leave_household(p_take_copy boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  hh uuid;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  select household_id into hh from public.household_members where user_id = me;
  if hh is null then return; end if;
  if p_take_copy then
    insert into public.items (space_id, user_id, collection, id, data)
      select me, me, collection, id, data from public.items
      where space_id = hh and collection <> 'settings'
      on conflict do nothing;
  end if;
  delete from public.household_members where user_id = me;
end;
$$;

-- Remove someone else from your household (for example someone who joined by mistake).
-- Their private kitchen is untouched.
create or replace function public.pk_remove_member(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare hh uuid := public.pk_my_household();
begin
  if hh is null then raise exception 'You are not in a household.'; end if;
  if p_user = auth.uid() then raise exception 'Use Leave household to remove yourself.'; end if;
  delete from public.household_members where user_id = p_user and household_id = hh;
end;
$$;

-- Replace the invite code, so the old code and link stop working.
create or replace function public.pk_new_invite_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  hh uuid := public.pk_my_household();
  code text;
begin
  if hh is null then raise exception 'You are not in a household.'; end if;
  loop
    code := public.pk_new_code();
    exit when not exists (select 1 from public.households where invite_code = code);
  end loop;
  update public.households set invite_code = code where id = hh;
  return code;
end;
$$;

-- Only signed-in people can call these; nobody can call the internal code generator directly.
revoke all on function public.pk_my_household()                  from public, anon;
revoke all on function public.pk_new_code()                      from public, anon, authenticated;
revoke all on function public.pk_clean_code(text)                from public, anon;
revoke all on function public.pk_create_household(text)          from public, anon;
revoke all on function public.pk_peek_household(text)            from public, anon;
revoke all on function public.pk_join_household(text, boolean)   from public, anon;
revoke all on function public.pk_leave_household(boolean)        from public, anon;
revoke all on function public.pk_remove_member(uuid)             from public, anon;
revoke all on function public.pk_new_invite_code()               from public, anon;
grant execute on function public.pk_my_household()                to authenticated;
grant execute on function public.pk_clean_code(text)              to authenticated;
grant execute on function public.pk_create_household(text)        to authenticated;
grant execute on function public.pk_peek_household(text)          to authenticated;
grant execute on function public.pk_join_household(text, boolean) to authenticated;
grant execute on function public.pk_leave_household(boolean)      to authenticated;
grant execute on function public.pk_remove_member(uuid)           to authenticated;
grant execute on function public.pk_new_invite_code()             to authenticated;

-- ===================================================================================
-- Housekeeping
-- ===================================================================================

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

-- When the last person leaves a household (by leaving, being removed or deleting their
-- account), delete the household.
create or replace function public.pk_member_left()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.household_members where household_id = old.household_id) then
    delete from public.households where id = old.household_id;
  end if;
  return null;
end;
$$;
revoke all on function public.pk_member_left() from public, anon, authenticated;

drop trigger if exists pk_member_left on public.household_members;
create trigger pk_member_left
  after delete on public.household_members
  for each row execute function public.pk_member_left();

-- When a household is deleted, delete its shared kitchen.
create or replace function public.pk_household_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.items where space_id = old.id;
  return null;
end;
$$;
revoke all on function public.pk_household_deleted() from public, anon, authenticated;

drop trigger if exists pk_household_deleted on public.households;
create trigger pk_household_deleted
  after delete on public.households
  for each row execute function public.pk_household_deleted();

-- Private kitchens are deleted with their account (items.user_id cascades).
