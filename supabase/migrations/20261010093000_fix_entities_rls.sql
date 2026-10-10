-- Fix entity registration RLS.
-- entities had SELECT-only policy, so Confirm as primary failed on upsert.

drop policy if exists entities_select on public.entities;
drop policy if exists entities_insert on public.entities;
drop policy if exists entities_update on public.entities;

-- Entities are shared provider catalog rows (Maps place, app id, channel).
-- Authenticated users may read/upsert them; tenant isolation is via workspace_entities.
create policy entities_select on public.entities
  for select to authenticated
  using (true);

create policy entities_insert on public.entities
  for insert to authenticated
  with check (true);

create policy entities_update on public.entities
  for update to authenticated
  using (true)
  with check (true);

-- Ensure workspace_entities / source_connections write policies have WITH CHECK
drop policy if exists workspace_entities_write on public.workspace_entities;
create policy workspace_entities_write on public.workspace_entities
  for all to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'editor'))
  with check (public.workspace_role(workspace_id) in ('owner', 'editor'));

drop policy if exists source_connections_write on public.source_connections;
create policy source_connections_write on public.source_connections
  for all to authenticated
  using (public.workspace_role(workspace_id) in ('owner', 'editor'))
  with check (public.workspace_role(workspace_id) in ('owner', 'editor'));

-- Atomic register helper
create or replace function public.register_workspace_entity(
  p_workspace_id uuid,
  p_source public.source_type,
  p_provider_id text,
  p_name text,
  p_kind public.workspace_kind,
  p_role public.entity_role,
  p_url text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.entities
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_entity public.entities;
  v_competitor_count int;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  if public.workspace_role(p_workspace_id) is distinct from 'owner'
     and public.workspace_role(p_workspace_id) is distinct from 'editor' then
    raise exception 'Workspace access denied';
  end if;

  if p_role = 'competitor' then
    select count(*) into v_competitor_count
    from public.workspace_entities
    where workspace_id = p_workspace_id and role = 'competitor';
    if v_competitor_count >= 3 then
      raise exception 'Maximum of three competitors per workspace';
    end if;
  end if;

  insert into public.entities as e (source, provider_id, name, kind, url, metadata)
  values (p_source, p_provider_id, p_name, p_kind, p_url, coalesce(p_metadata, '{}'::jsonb))
  on conflict (source, provider_id) do update
    set name = excluded.name,
        kind = excluded.kind,
        url = coalesce(excluded.url, e.url),
        metadata = coalesce(excluded.metadata, e.metadata),
        updated_at = now()
  returning * into v_entity;

  insert into public.workspace_entities (workspace_id, entity_id, role)
  values (p_workspace_id, v_entity.id, p_role)
  on conflict (workspace_id, entity_id) do update
    set role = excluded.role;

  insert into public.source_connections (workspace_id, entity_id, source, config)
  values (p_workspace_id, v_entity.id, p_source, coalesce(p_metadata, '{}'::jsonb))
  on conflict (workspace_id, entity_id, source) do update
    set config = excluded.config;

  insert into public.audit_events (workspace_id, actor_user_id, action, target_type, target_id, metadata)
  values (
    p_workspace_id,
    v_user,
    'entity.registered',
    'entity',
    v_entity.id,
    jsonb_build_object('role', p_role)
  );

  return v_entity;
end;
$$;

grant execute on function public.register_workspace_entity(
  uuid, public.source_type, text, text, public.workspace_kind, public.entity_role, text, jsonb
) to authenticated;
