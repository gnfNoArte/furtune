-- hfNoArte — Row Level Security. Each user only ever sees their own rows.

alter table public.profiles enable row level security;
alter table public.candidate_profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.preferences enable row level security;
alter table public.notification_settings enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_links enable row level security;
alter table public.drafts enable row level security;
alter table public.opportunity_events enable row level security;
alter table public.discovery_runs enable row level security;
alter table public.source_runs enable row level security;
alter table public.notifications enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'candidate_profiles', 'resumes', 'preferences', 'notification_settings',
    'opportunities', 'opportunity_links', 'drafts', 'discovery_runs',
    'source_runs', 'notifications'
  ] loop
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- The activity log is append-only for users.
create policy "read own events" on public.opportunity_events
  for select to authenticated using (user_id = auth.uid());
create policy "add own events" on public.opportunity_events
  for insert to authenticated with check (user_id = auth.uid());

-- A link or draft must point at one of the user's own opportunities.
create or replace function public.owns_opportunity(oid uuid)
returns boolean language sql stable security invoker as $$
  select exists (select 1 from public.opportunities o where o.id = oid and o.user_id = auth.uid())
$$;

create policy "link belongs to own opportunity" on public.opportunity_links
  as restrictive for all to authenticated
  using (public.owns_opportunity(opportunity_id)) with check (public.owns_opportunity(opportunity_id));
create policy "draft belongs to own opportunity" on public.drafts
  as restrictive for all to authenticated
  using (public.owns_opportunity(opportunity_id)) with check (public.owns_opportunity(opportunity_id));

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke update, delete on public.opportunity_events from authenticated;
grant execute on function public.approve_applications(uuid[], boolean) to authenticated;
grant execute on function public.revoke_approval(uuid) to authenticated;
revoke all on all tables in schema public from anon;
