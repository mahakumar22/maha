\set ON_ERROR_STOP on
set client_min_messages = notice;
\set QUIET on
\pset tuples_only on
\pset format unaligned

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

create or replace function act_as(who uuid) returns void language plpgsql as $$
begin perform set_config('request.jwt.claim.sub', who::text, false); end; $$;

create or replace function must_fail(stmt text, label text) returns void
language plpgsql as $$
begin
  begin execute stmt;
  exception when others then raise notice 'PASS  %', label; return;
  end;
  raise exception 'FAIL  % -- statement was allowed but must not be', label;
end; $$;

create or replace function must_equal(got anyelement, want anyelement, label text)
returns void language plpgsql as $$
begin
  if got is distinct from want then
    raise exception 'FAIL  % -- got %, want %', label, got, want;
  end if;
  raise notice 'PASS  %', label;
end; $$;

\echo '--- Alice ---'
set role authenticated;
select act_as('11111111-1111-1111-1111-111111111111');
insert into public.habits (user_id, name)
  values ('11111111-1111-1111-1111-111111111111', 'Read 20 pages');
select must_fail(
  $$insert into public.habits (user_id, name)
      values ('22222222-2222-2222-2222-222222222222', 'planted')$$,
  'cannot create a habit owned by someone else');

select id as alice_habit from public.habits where name = 'Read 20 pages' \gset

insert into public.habit_completions (habit_id, completed_on)
  values (:'alice_habit', date '2026-09-08');
select must_equal((select user_id from public.habit_completions),
  '11111111-1111-1111-1111-111111111111'::uuid,
  'trigger stamps the habit owner onto a completion');

insert into public.habit_completions (habit_id, user_id, completed_on)
  values (:'alice_habit', '22222222-2222-2222-2222-222222222222', date '2026-09-07');
select must_equal((select count(*)::int from public.habit_completions
    where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'a forged user_id is overwritten, not trusted');

select must_fail(
  $$insert into public.habit_completions (habit_id, completed_on)
      values ('$$ || :'alice_habit' || $$', date '2026-09-08')$$,
  'one habit cannot be completed twice on the same day');

insert into public.habit_completions (habit_id, completed_on)
  values (:'alice_habit', date '2026-09-08')
  on conflict (habit_id, completed_on) do nothing;
select must_equal((select count(*)::int from public.habit_completions), 2,
  'a repeated tap is a no-op (the app''s upsert), not a duplicate');

\echo '--- Bob attacks Alice ---'
select act_as('22222222-2222-2222-2222-222222222222');
insert into public.habits (user_id, name)
  values ('22222222-2222-2222-2222-222222222222', 'Stretch');

select must_equal((select count(*)::int from public.habits), 1,
  'Bob sees only his own habit');
select must_equal((select count(*)::int from public.habits
    where id = :'alice_habit'), 0,
  'Bob cannot read Alice''s habit even knowing its id');
select must_equal((select count(*)::int from public.habit_completions), 0,
  'Bob cannot read Alice''s completions');

with d as (delete from public.habits where id = :'alice_habit' returning 1)
  select count(*)::int as n from d \gset
select must_equal(:n, 0, 'Bob cannot delete Alice''s habit');

with u as (update public.habits set name = 'pwned'
             where id = :'alice_habit' returning 1)
  select count(*)::int as n from u \gset
select must_equal(:n, 0, 'Bob cannot rename Alice''s habit');

with d as (delete from public.habit_completions
             where habit_id = :'alice_habit' returning 1)
  select count(*)::int as n from d \gset
select must_equal(:n, 0, 'Bob cannot erase Alice''s completions');
select must_fail(
  $$insert into public.habit_completions (habit_id, completed_on)
      values ('$$ || :'alice_habit' || $$', date '2026-09-01')$$,
  'Bob cannot log a completion against Alice''s habit');

\echo '--- constraints and cascades ---'
select act_as('11111111-1111-1111-1111-111111111111');
select must_equal((select count(*)::int from public.habit_completions), 2,
  'Alice''s data survived all of that intact');

select must_fail($$insert into public.habits (user_id, name)
    values ('11111111-1111-1111-1111-111111111111', '   ')$$,
  'a blank habit name is rejected');
select must_fail($$insert into public.habits (user_id, name)
    values ('11111111-1111-1111-1111-111111111111', repeat('x', 81))$$,
  'an over-long habit name is rejected');

delete from public.habits where id = :'alice_habit';
select must_equal((select count(*)::int from public.habit_completions), 0,
  'deleting a habit cascades to its completions');

reset role;
delete from auth.users where id = '22222222-2222-2222-2222-222222222222';
select must_equal((select count(*)::int from public.habits
    where user_id = '22222222-2222-2222-2222-222222222222'), 0,
  'deleting a user cascades to their habits');

\echo ''
\echo 'ALL DATABASE TESTS PASSED'
