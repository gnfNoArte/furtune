-- hfNoArte — approval rules, enforced in the database.
--
-- Policy: nothing is ever submitted or sent by hfNoArte. Approval means
-- "the candidate has reviewed this and may now use it on the employer's or
-- platform's own site". These triggers make sure approval can only come from
-- an explicit action by the signed-in candidate, never from the browser
-- tampering with fields, and never from the scheduled discovery job.

-- ─── Drafts ──────────────────────────────────────────────────
create or replace function public.enforce_draft_review()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.review_state not in ('draft', 'pending_review') then
      raise exception 'A new draft must start as draft or pending_review';
    end if;
    new.approved_at := null;
    new.rejected_at := null;
    return new;
  end if;

  -- Editing an approved draft sends it back for review.
  if new.content is distinct from old.content and old.review_state = 'approved' then
    new.review_state := 'pending_review';
  end if;

  if new.review_state is distinct from old.review_state then
    if new.review_state = 'approved' then
      if old.review_state <> 'pending_review' then
        raise exception 'Only drafts that are pending review can be approved';
      end if;
      if auth.uid() is null then
        raise exception 'Approval requires a signed-in candidate';
      end if;
      new.approved_at := now();
      new.rejected_at := null;
    elsif new.review_state = 'rejected' then
      new.rejected_at := now();
      new.approved_at := null;
    else
      new.approved_at := null;
      new.rejected_at := null;
    end if;
  else
    -- Timestamps are server-controlled.
    new.approved_at := old.approved_at;
    new.rejected_at := old.rejected_at;
  end if;
  return new;
end $$;

create trigger drafts_enforce_review
  before insert or update on public.drafts
  for each row execute function public.enforce_draft_review();

-- ─── Opportunities ───────────────────────────────────────────
-- Statuses that mean the candidate has acted outside hfNoArte.
create or replace function public.status_requires_approval(s public.opportunity_status)
returns boolean language sql immutable as $$
  select s in ('contacted', 'applied', 'follow_up', 'interview', 'won')
$$;

create or replace function public.enforce_opportunity_approval()
returns trigger language plpgsql as $$
declare
  approving boolean := coalesce(current_setting('hfnoarte.approval', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    new.approved_at := null;
    if public.status_requires_approval(new.status) then
      raise exception 'Status % needs the candidate''s approval first', new.status;
    end if;
    return new;
  end if;

  -- approved_at only changes through approve_application / revoke_approval.
  if not approving then
    new.approved_at := old.approved_at;
  end if;

  if public.status_requires_approval(new.status)
     and new.status is distinct from old.status
     and new.approved_at is null then
    raise exception 'Status % needs the candidate''s approval first', new.status;
  end if;

  if new.status = 'applied' and old.status is distinct from 'applied' and new.applied_at is null then
    new.applied_at := now();
  end if;
  if new.status = 'contacted' and old.status is distinct from 'contacted' and new.contacted_at is null then
    new.contacted_at := now();
  end if;
  return new;
end $$;

create trigger opportunities_enforce_approval
  before insert or update on public.opportunities
  for each row execute function public.enforce_opportunity_approval();

-- Approve one or many applications. Runs as the caller, so Row Level Security
-- limits it to the caller's own opportunities.
create or replace function public.approve_applications(
  opportunity_ids uuid[],
  allow_without_material boolean default false
)
returns table (opportunity_id uuid, approved boolean, message text)
language plpgsql security invoker set search_path = public as $$
declare
  oid uuid;
  material int;
begin
  if auth.uid() is null then
    raise exception 'Approval requires a signed-in candidate';
  end if;

  foreach oid in array opportunity_ids loop
    if not exists (select 1 from opportunities o where o.id = oid and o.user_id = auth.uid()) then
      opportunity_id := oid; approved := false; message := 'Not found';
      return next; continue;
    end if;

    select count(*) into material from drafts d
      where d.opportunity_id = oid and d.review_state in ('pending_review', 'approved');

    if material = 0 and not allow_without_material then
      opportunity_id := oid; approved := false;
      message := 'Nothing prepared to approve. Prepare material first, or approve without material.';
      return next; continue;
    end if;

    update drafts set review_state = 'approved'
      where drafts.opportunity_id = oid and review_state = 'pending_review';

    perform set_config('hfnoarte.approval', 'on', true);
    update opportunities set approved_at = now(),
      status = case when status in ('new', 'saved', 'reviewing', 'interested') then 'message_prepared'::opportunity_status else status end
      where id = oid;
    perform set_config('hfnoarte.approval', 'off', true);

    insert into opportunity_events (user_id, opportunity_id, event, detail)
      values (auth.uid(), oid, 'approved', jsonb_build_object('drafts', material));

    opportunity_id := oid; approved := true; message := 'Approved';
    return next;
  end loop;
end $$;

create or replace function public.revoke_approval(opportunity_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Requires a signed-in candidate';
  end if;
  perform set_config('hfnoarte.approval', 'on', true);
  update opportunities o set approved_at = null
    where o.id = revoke_approval.opportunity_id
      and not public.status_requires_approval(o.status);
  perform set_config('hfnoarte.approval', 'off', true);
  update drafts d set review_state = 'pending_review'
    where d.opportunity_id = revoke_approval.opportunity_id and d.review_state = 'approved';
end $$;

-- Log every status change.
create or replace function public.log_status_change()
returns trigger language plpgsql as $$
begin
  if new.status is distinct from old.status then
    insert into public.opportunity_events (user_id, opportunity_id, event, detail)
      values (new.user_id, new.id, 'status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  return null;
end $$;

create trigger opportunities_log_status
  after update on public.opportunities
  for each row execute function public.log_status_change();
