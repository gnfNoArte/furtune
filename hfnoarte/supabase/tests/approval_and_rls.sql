-- Behaviour tests for approval rules and Row Level Security.
\set ON_ERROR_STOP 1
\set QUIET 1
create extension if not exists pgcrypto;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@example.com');

-- signup trigger created rows
do $$ begin
  assert (select count(*) from public.preferences) = 2, 'preferences rows created';
  assert (select count(*) from public.notification_settings) = 2, 'notification rows created';
end $$;

grant service_role to current_user;
grant authenticated to current_user;
grant all on all tables in schema public to service_role;

-- Act as user A
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

insert into public.opportunities (id, user_id, fingerprint, kind, title)
values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'fp1', 'employment', 'Webflow Designer');

-- 1. Cannot set approved_at directly
update public.opportunities set approved_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select approved_at from public.opportunities where id = 'aaaaaaaa-0000-0000-0000-000000000001') is null,
    'approved_at cannot be set directly';
end $$;

-- 2. Cannot mark applied without approval
do $$ begin
  begin
    update public.opportunities set status = 'applied' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'FAIL: applied without approval was allowed';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 3. Cannot insert an already-approved draft
do $$ begin
  begin
    insert into public.drafts (user_id, opportunity_id, kind, title, content, review_state)
    values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'cover_letter', 'CL', 'x', 'approved');
    raise exception 'FAIL: inserted approved draft';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 4. Draft cannot jump from draft straight to approved
insert into public.drafts (id, user_id, opportunity_id, kind, title, content)
values ('dddddddd-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'cover_letter', 'CL', 'Hello');
do $$ begin
  begin
    update public.drafts set review_state = 'approved' where id = 'dddddddd-0000-0000-0000-000000000001';
    raise exception 'FAIL: draft approved without review';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

-- 5. Approval with nothing pending is refused unless explicitly allowed
do $$ begin
  assert (select approved from public.approve_applications(array['aaaaaaaa-0000-0000-0000-000000000001'::uuid])) = false,
    'approval refused with no material in review';
end $$;

-- 6. Normal flow: send for review → approve → applied
update public.drafts set review_state = 'pending_review' where id = 'dddddddd-0000-0000-0000-000000000001';
do $$ begin
  assert (select approved from public.approve_applications(array['aaaaaaaa-0000-0000-0000-000000000001'::uuid])) = true,
    'approval succeeded';
  assert (select review_state from public.drafts where id = 'dddddddd-0000-0000-0000-000000000001') = 'approved', 'draft approved';
  assert (select approved_at from public.drafts where id = 'dddddddd-0000-0000-0000-000000000001') is not null, 'draft approved_at set';
  assert (select approved_at from public.opportunities where id = 'aaaaaaaa-0000-0000-0000-000000000001') is not null, 'opportunity approved';
end $$;
update public.opportunities set status = 'applied' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
do $$ begin
  assert (select applied_at from public.opportunities where id = 'aaaaaaaa-0000-0000-0000-000000000001') is not null, 'applied_at stamped';
end $$;

-- 7. Editing an approved draft sends it back to review
update public.drafts set content = 'Hello, edited' where id = 'dddddddd-0000-0000-0000-000000000001';
do $$ begin
  assert (select review_state from public.drafts where id = 'dddddddd-0000-0000-0000-000000000001') = 'pending_review',
    'edited approved draft returns to review';
end $$;

-- 8. Status changes are logged
do $$ begin
  assert (select count(*) from public.opportunity_events where event = 'status') >= 1, 'status logged';
end $$;

-- 9. RLS: user B sees nothing of user A and cannot write into A's opportunity
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from public.opportunities) = 0, 'B cannot read A opportunities';
  assert (select count(*) from public.drafts) = 0, 'B cannot read A drafts';
  assert (select approved from public.approve_applications(array['aaaaaaaa-0000-0000-0000-000000000001'::uuid])) = false,
    'B cannot approve A';
end $$;
do $$ begin
  begin
    insert into public.drafts (user_id, opportunity_id, kind, title, content)
    values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000001', 'dm', 'x', 'x');
    raise exception 'FAIL: B attached a draft to A opportunity';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
update public.opportunities set title = 'hacked' where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- 10. Service role (the scheduled job) cannot approve anything
reset role;
set role service_role;
select set_config('request.jwt.claim.sub', '', false);
do $$ begin
  assert (select title from public.opportunities where id = 'aaaaaaaa-0000-0000-0000-000000000001') = 'Webflow Designer',
    'B could not edit A row';
  begin
    perform public.approve_applications(array['aaaaaaaa-0000-0000-0000-000000000001'::uuid]);
    raise exception 'FAIL: service role approved';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;
insert into public.opportunities (id, user_id, fingerprint, kind, title)
values ('aaaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'fp2', 'social', 'Need a Framer site');
insert into public.drafts (id, user_id, opportunity_id, kind, title, content, review_state)
values ('dddddddd-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 'dm', 'DM', 'Hi', 'pending_review');
do $$ begin
  begin
    update public.drafts set review_state = 'approved' where id = 'dddddddd-0000-0000-0000-000000000002';
    raise exception 'FAIL: service role approved a draft';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
end $$;

\echo ALL DATABASE TESTS PASSED
