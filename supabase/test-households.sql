-- Self-test for shared households. Changes nothing: it makes three throwaway accounts,
-- acts as each of them, checks every rule, and then undoes all of it.
-- Run in Supabase: SQL Editor -> New query -> paste -> Run.
-- The result is always an error box (that is how the undo works). Read its message:
--   "ALL N CHECKS PASSED"  -> everything works
--   "FAILED: ..."          -> lists the checks that did not behave as expected

do $$
declare
  a uuid := gen_random_uuid();   -- creates the household
  b uuid := gen_random_uuid();   -- joins it
  c uuid := gen_random_uuid();   -- outsider
  hh uuid; code text; code2 text; n int; t text;
  passed int := 0; failed text := '';
begin
  insert into auth.users (id, email, aud, role, instance_id)
  values (a, 'pk-selftest-a@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
         (b, 'pk-selftest-b@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
         (c, 'pk-selftest-c@example.invalid', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

  -- Private kitchens, saved the way the app saves them.
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  insert into public.items (space_id, user_id, collection, id, data) values
    (a, a, 'pantry', 'p_a1', '{"name":"Rice"}'), (a, a, 'recipes', 'r_a1', '{"name":"Chili"}'),
    (a, a, 'recipes', 'ex_shared', '{"name":"Example from A"}'), (a, a, 'settings', 'prefs', '{"theme":"dark"}');
  -- A copy of the app from before households (saves with on conflict user_id) still works.
  insert into public.items (user_id, collection, id, data) values (a, 'shopping', 's_a1', '{"name":"Milk"}')
    on conflict (user_id, collection, id) do update set data = excluded.data;
  insert into public.items (user_id, collection, id, data) values (a, 'shopping', 's_a1', '{"name":"Oat milk"}')
    on conflict (user_id, collection, id) do update set data = excluded.data;
  select data->>'name' into t from public.items where space_id = a and id = 's_a1';
  if t = 'Oat milk' then passed := passed + 1; else failed := failed || ' [old app upsert]'; end if;

  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  insert into public.items (space_id, user_id, collection, id, data) values
    (b, b, 'pantry', 'p_b1', '{"name":"Beans"}'), (b, b, 'recipes', 'r_b1', '{"name":"Curry"}'),
    (b, b, 'recipes', 'ex_shared', '{"name":"Example from B"}'), (b, b, 'settings', 'prefs', '{"theme":"light"}');
  select count(*) into n from public.items where space_id = a;
  if n = 0 then passed := passed + 1; else failed := failed || ' [B saw A private]'; end if;

  -- A creates a household: A's kitchen moves in, A's settings stay private.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  hh := public.pk_create_household('Self-test kitchen');
  select invite_code into code from public.households where id = hh;
  if code ~ '^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{2}$' then passed := passed + 1; else failed := failed || ' [code format ' || coalesce(code, 'null') || ']'; end if;
  select count(*) into n from public.items where space_id = hh and user_id is null;
  if n = 4 then passed := passed + 1; else failed := failed || ' [moved rows ' || n || ']'; end if;
  select count(*) into n from public.items where space_id = a and collection = 'settings';
  if n = 1 then passed := passed + 1; else failed := failed || ' [A settings stayed private]'; end if;

  -- C (outsider) sees nothing of the household and can't write into it.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.items where space_id = hh;
  if n = 0 then passed := passed + 1; else failed := failed || ' [C read household items]'; end if;
  select count(*) into n from public.households;
  if n = 0 then passed := passed + 1; else failed := failed || ' [C read households]'; end if;
  begin
    insert into public.items (space_id, user_id, collection, id, data) values (hh, null, 'pantry', 'p_c1', '{}');
    failed := failed || ' [C inserted into household]';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  update public.items set data = '{"name":"hacked"}' where space_id = hh;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || ' [C updated household]'; end if;
  delete from public.items where space_id = hh;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || ' [C deleted household]'; end if;
  -- C can't make itself a member directly, or change the invite code.
  begin
    insert into public.household_members (user_id, household_id) values (c, hh);
    failed := failed || ' [C inserted membership]';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  -- A wrong code finds nothing.
  select count(*) into n from public.pk_peek_household('ZZZZ-ZZZZ-ZZ');
  if n = 0 or code = 'ZZZZ-ZZZZ-ZZ' then passed := passed + 1; else failed := failed || ' [wrong code peek]'; end if;

  -- B peeks with a messy code, then joins bringing recipes.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  select name, members into t, n from public.pk_peek_household('https://x.test/?join=' || lower(replace(code, '-', ' ')));
  if t = 'Self-test kitchen' and n = 1 then passed := passed + 1; else failed := failed || ' [peek]'; end if;
  perform public.pk_join_household(lower(code), true);
  select count(*) into n from public.items where space_id = hh and collection = 'recipes';
  if n = 3 then passed := passed + 1; else failed := failed || ' [recipes after join ' || n || ']'; end if;
  select data->>'name' into t from public.items where space_id = hh and id = 'ex_shared';
  if t = 'Example from A' then passed := passed + 1; else failed := failed || ' [same-ID recipe kept household version]'; end if;
  select count(*) into n from public.items where space_id = b and collection <> 'settings';
  if n = 3 then passed := passed + 1; else failed := failed || ' [B private kitchen kept ' || n || ']'; end if;
  select count(*) into n from public.household_members;
  if n = 2 then passed := passed + 1; else failed := failed || ' [B sees members ' || n || ']'; end if;

  -- B edits A's shared row and adds a shared row, the way the app does (upsert on space_id).
  insert into public.items (space_id, user_id, collection, id, data) values (hh, null, 'pantry', 'p_a1', '{"name":"Brown rice"}')
    on conflict (space_id, collection, id) do update set data = excluded.data;
  insert into public.items (space_id, user_id, collection, id, data) values (hh, null, 'pantry', 'p_b2', '{"name":"Lentils"}')
    on conflict (space_id, collection, id) do update set data = excluded.data;
  passed := passed + 1;
  -- Settings can't go into the household, and a shared row can't be claimed by one person.
  begin
    insert into public.items (space_id, user_id, collection, id, data) values (hh, null, 'settings', 'prefs', '{}');
    failed := failed || ' [settings into household]';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  begin
    update public.items set user_id = b where space_id = hh and id = 'p_b2';
    failed := failed || ' [claimed shared row]';
  exception when insufficient_privilege then passed := passed + 1;
  end;
  -- B can't touch A's private settings.
  update public.items set data = '{}' where space_id = a;
  get diagnostics n = row_count;
  if n = 0 then passed := passed + 1; else failed := failed || ' [B changed A settings]'; end if;
  -- B can rename the household but not change its invite code.
  update public.households set name = 'Renamed kitchen' where id = hh;
  get diagnostics n = row_count;
  if n = 1 then passed := passed + 1; else failed := failed || ' [rename]'; end if;
  begin
    update public.households set invite_code = 'AAAA-AAAA-AA' where id = hh;
    failed := failed || ' [changed invite code directly]';
  exception when insufficient_privilege then passed := passed + 1;
  end;

  -- A sees B's edits.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  select data->>'name' into t from public.items where space_id = hh and id = 'p_a1';
  if t = 'Brown rice' then passed := passed + 1; else failed := failed || ' [A sees B edit]'; end if;

  -- New code: the old one stops working.
  code2 := public.pk_new_invite_code();
  select count(*) into n from public.pk_peek_household(code);
  if code2 <> code and n = 0 then passed := passed + 1; else failed := failed || ' [new code]'; end if;

  -- C can't join with the old code, can with the new one, and A removes C again.
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  begin
    perform public.pk_join_household(code, false);
    failed := failed || ' [joined with old code]';
  exception when raise_exception then passed := passed + 1;
  end;
  perform public.pk_join_household(code2, false);
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.pk_remove_member(c);
  perform set_config('request.jwt.claims', json_build_object('sub', c, 'role', 'authenticated')::text, true);
  select count(*) into n from public.items where space_id = hh;
  if n = 0 then passed := passed + 1; else failed := failed || ' [removed member still reads]'; end if;

  -- B leaves taking a copy: B's private kitchen gets the shared items, its own version wins on the same ID.
  perform set_config('request.jwt.claims', json_build_object('sub', b, 'role', 'authenticated')::text, true);
  perform public.pk_leave_household(true);
  select count(*) into n from public.items where space_id = hh;
  if n = 0 then passed := passed + 1; else failed := failed || ' [B still reads after leaving]'; end if;
  select count(*) into n from public.items where space_id = b and collection <> 'settings';
  -- B had p_b1, r_b1, ex_shared; household had p_a1, p_b2, r_a1, r_b1, ex_shared, s_a1 -> adds p_a1, p_b2, r_a1, s_a1.
  if n = 7 then passed := passed + 1; else failed := failed || ' [B copy count ' || n || ']'; end if;
  select data->>'name' into t from public.items where space_id = b and id = 'ex_shared';
  if t = 'Example from B' then passed := passed + 1; else failed := failed || ' [B own version kept]'; end if;

  -- A leaves last: the household and its shared kitchen are deleted; A's settings remain.
  perform set_config('request.jwt.claims', json_build_object('sub', a, 'role', 'authenticated')::text, true);
  perform public.pk_leave_household(false);
  perform set_config('role', 'postgres', true);
  select count(*) into n from public.households where id = hh;
  if n = 0 then passed := passed + 1; else failed := failed || ' [household not deleted]'; end if;
  select count(*) into n from public.items where space_id = hh;
  if n = 0 then passed := passed + 1; else failed := failed || ' [shared kitchen not deleted]'; end if;
  select count(*) into n from public.items where space_id = a and collection = 'settings';
  if n = 1 then passed := passed + 1; else failed := failed || ' [A settings]'; end if;

  -- Deleting an account deletes its private kitchen.
  delete from auth.users where id = b;
  select count(*) into n from public.items where space_id = b;
  if n = 0 then passed := passed + 1; else failed := failed || ' [B private rows after account delete]'; end if;

  if failed = '' then
    raise exception 'ALL % CHECKS PASSED (nothing was saved)', passed;
  else
    raise exception 'FAILED:% (% passed; nothing was saved)', failed, passed;
  end if;
end $$;
