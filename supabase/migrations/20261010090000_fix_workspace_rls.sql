-- Fix workspace bootstrap RLS:
-- 1) Owners can SELECT their own workspace (needed for insert().select())
-- 2) Owners can INSERT their first membership row
-- 3) Atomic create_workspace() RPC for reliable onboarding

grant usage on schema public to authenticated, anon, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;

-- Replace workspace select: members OR owner
drop policy if exists workspaces_select on public.workspaces;
create policy workspaces_select on public.workspaces
  for select using (
    deleted_at is null
    and (
      owner_user_id = auth.uid()
      or public.is_workspace_member(id)
    )
  );

-- Keep insert as owner_user_id = auth.uid()
drop policy if exists workspaces_insert on public.workspaces;
create policy workspaces_insert on public.workspaces
  for insert
  with check (auth.uid() = owner_user_id);

-- Memberships: allow owner bootstrap insert + owner manage
drop policy if exists memberships_manage on public.memberships;
drop policy if exists memberships_insert_owner on public.memberships;
drop policy if exists memberships_update_owner on public.memberships;
drop policy if exists memberships_delete_owner on public.memberships;

create policy memberships_insert_owner on public.memberships
  for insert
  with check (
    user_id = auth.uid()
    and (
      exists (
        select 1 from public.workspaces w
        where w.id = workspace_id
          and w.owner_user_id = auth.uid()
          and w.deleted_at is null
      )
      or public.workspace_role(workspace_id) = 'owner'
    )
  );

create policy memberships_update_owner on public.memberships
  for update
  using (public.workspace_role(workspace_id) = 'owner')
  with check (public.workspace_role(workspace_id) = 'owner');

create policy memberships_delete_owner on public.memberships
  for delete
  using (public.workspace_role(workspace_id) = 'owner');

-- Taxonomy / topics bootstrap for workspace owners before memberships exist
drop policy if exists taxonomy_versions_write on public.taxonomy_versions;
drop policy if exists topics_write on public.topics;
drop policy if exists audit_events_write on public.audit_events;

create policy taxonomy_versions_write on public.taxonomy_versions
  for all using (
    public.workspace_role(workspace_id) in ('owner', 'editor')
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  )
  with check (
    public.workspace_role(workspace_id) in ('owner', 'editor')
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  );

create policy topics_write on public.topics
  for all using (
    public.workspace_role(workspace_id) in ('owner', 'editor')
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  )
  with check (
    public.workspace_role(workspace_id) in ('owner', 'editor')
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  );

create policy audit_events_write on public.audit_events
  for all using (
    public.workspace_role(workspace_id) in ('owner', 'editor')
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  )
  with check (
    public.workspace_role(workspace_id) in ('owner', 'editor')
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_user_id = auth.uid()
    )
  );

-- Atomic workspace creation (preferred path)
create or replace function public.create_workspace(
  p_name text,
  p_kind public.workspace_kind,
  p_timezone text default 'UTC',
  p_language text default 'en',
  p_analysis_window_days int default 90,
  p_refresh_cadence_hours int default 24,
  p_retrieval_budget int default 200
)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_workspace public.workspaces;
  v_taxonomy public.taxonomy_versions;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.workspaces (
    name, kind, owner_user_id, timezone, language,
    analysis_window_days, refresh_cadence_hours, retrieval_budget
  ) values (
    p_name, p_kind, v_user, p_timezone, p_language,
    p_analysis_window_days, p_refresh_cadence_hours, p_retrieval_budget
  )
  returning * into v_workspace;

  insert into public.memberships (workspace_id, user_id, role)
  values (v_workspace.id, v_user, 'owner');

  insert into public.taxonomy_versions (workspace_id, version, label, active)
  values (v_workspace.id, 1, 'initial', true)
  returning * into v_taxonomy;

  if p_kind = 'business' then
    insert into public.topics (workspace_id, taxonomy_version_id, key, name, definition, domain, status) values
      (v_workspace.id, v_taxonomy.id, 'food_quality', 'Food quality', 'Taste, freshness, temperature, and preparation of food items.', 'business', 'active'),
      (v_workspace.id, v_taxonomy.id, 'service', 'Service', 'Staff attentiveness, friendliness, accuracy of orders.', 'business', 'active'),
      (v_workspace.id, v_taxonomy.id, 'wait_time', 'Wait time', 'Queue, seating, or order fulfillment delays.', 'business', 'active'),
      (v_workspace.id, v_taxonomy.id, 'cleanliness', 'Cleanliness', 'Hygiene of premises, restrooms, tables, utensils.', 'business', 'active'),
      (v_workspace.id, v_taxonomy.id, 'value', 'Value / price', 'Perceived worth relative to price paid.', 'business', 'active'),
      (v_workspace.id, v_taxonomy.id, 'atmosphere', 'Atmosphere', 'Ambience, noise, seating comfort, décor.', 'business', 'active');
  elsif p_kind = 'app' then
    insert into public.topics (workspace_id, taxonomy_version_id, key, name, definition, domain, status) values
      (v_workspace.id, v_taxonomy.id, 'reliability', 'Reliability / crashes', 'Stability, crashes, freezes, failed loads.', 'app', 'active'),
      (v_workspace.id, v_taxonomy.id, 'performance', 'Performance', 'Speed, lag, battery drain unrelated to crashes.', 'app', 'active'),
      (v_workspace.id, v_taxonomy.id, 'ux', 'Usability / UX', 'Navigation clarity, layout, ease of completing tasks.', 'app', 'active'),
      (v_workspace.id, v_taxonomy.id, 'features', 'Features', 'Presence, usefulness, or absence of product capabilities.', 'app', 'active'),
      (v_workspace.id, v_taxonomy.id, 'pricing', 'Pricing / subscriptions', 'Cost, paywalls, billing clarity.', 'app', 'active'),
      (v_workspace.id, v_taxonomy.id, 'support', 'Customer support', 'Help desk responsiveness and resolution quality.', 'app', 'active');
  else
    insert into public.topics (workspace_id, taxonomy_version_id, key, name, definition, domain, status) values
      (v_workspace.id, v_taxonomy.id, 'content_quality', 'Content quality', 'Production quality, usefulness, accuracy of the video/post.', 'creator', 'active'),
      (v_workspace.id, v_taxonomy.id, 'topic_fit', 'Topic / relevance', 'Whether the topic matches audience expectations.', 'creator', 'active'),
      (v_workspace.id, v_taxonomy.id, 'pacing', 'Pacing / length', 'Pace, length, filler, or editing rhythm.', 'creator', 'active'),
      (v_workspace.id, v_taxonomy.id, 'hook', 'Hook / intro', 'Opening engagement and clarity of the premise.', 'creator', 'active'),
      (v_workspace.id, v_taxonomy.id, 'cta_clarity', 'CTA clarity', 'Clarity of calls to action without inventing demand.', 'creator', 'active'),
      (v_workspace.id, v_taxonomy.id, 'community', 'Community interaction', 'Creator responses and community tone in comments.', 'creator', 'active');
  end if;

  insert into public.audit_events (workspace_id, actor_user_id, action, target_type, target_id)
  values (v_workspace.id, v_user, 'workspace.created', 'workspace', v_workspace.id);

  return v_workspace;
end;
$$;

grant execute on function public.create_workspace(
  text, public.workspace_kind, text, text, int, int, int
) to authenticated;
