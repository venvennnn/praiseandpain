-- Praise & Pain initial schema
-- Timestamps stored in UTC. Tenant isolation via workspace_id + RLS.

create extension if not exists "pgcrypto";

create type public.workspace_kind as enum ('business', 'app', 'creator');
create type public.member_role as enum ('owner', 'editor', 'viewer');
create type public.entity_role as enum ('primary', 'competitor');
create type public.source_type as enum (
  'google_maps',
  'apple_app_store',
  'google_play',
  'youtube',
  'csv_import',
  'json_import'
);
create type public.date_precision as enum ('exact', 'day', 'month', 'relative', 'unknown');
create type public.run_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
create type public.run_stage as enum (
  'discover', 'collect', 'normalise', 'classify',
  'aggregate', 'compare', 'alert', 'summarise'
);
create type public.task_status as enum ('needs_attention', 'in_progress', 'monitoring', 'closed');
create type public.idea_status as enum ('considering', 'planned', 'published');
create type public.classification_status as enum ('ok', 'uncertain', 'failed', 'skipped');
create type public.topic_status as enum ('active', 'pending', 'rejected', 'archived');

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.workspace_kind not null,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  timezone text not null default 'UTC',
  language text not null default 'en',
  analysis_window_days int not null default 90 check (analysis_window_days between 7 and 365),
  refresh_cadence_hours int not null default 24 check (refresh_cadence_hours between 6 and 168),
  retrieval_budget int not null default 200 check (retrieval_budget between 10 and 5000),
  usage_limit int not null default 2000,
  usage_consumed int not null default 0,
  paused boolean not null default false,
  retention_days int not null default 365,
  comparison_min_mentions int not null default 30,
  comparison_practical_diff numeric not null default 0.05,
  comparison_posterior_threshold numeric not null default 0.95,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.entities (
  id uuid primary key default gen_random_uuid(),
  source public.source_type not null,
  provider_id text not null,
  name text not null,
  kind public.workspace_kind not null,
  url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, provider_id)
);

create table public.workspace_entities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  role public.entity_role not null,
  created_at timestamptz not null default now(),
  unique (workspace_id, entity_id)
);

create unique index workspace_one_primary
  on public.workspace_entities (workspace_id)
  where role = 'primary';

create table public.source_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  source public.source_type not null,
  config jsonb not null default '{}'::jsonb,
  cursor jsonb,
  last_synced_at timestamptz,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (workspace_id, entity_id, source)
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  source public.source_type not null,
  provider_id text not null,
  title text,
  url text,
  published_at timestamptz,
  transcript text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (workspace_id, source, provider_id)
);

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  content_item_id uuid references public.content_items(id) on delete set null,
  source public.source_type not null,
  provider_id text not null,
  original_text text not null,
  original_date_string text,
  published_at timestamptz,
  date_precision public.date_precision not null default 'unknown',
  retrieved_at timestamptz not null default now(),
  language text,
  rating numeric,
  source_url text,
  content_hash text not null,
  author_name text,
  is_duplicate boolean not null default false,
  crosses_boundary_risk boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, source, provider_id)
);

create index feedback_workspace_published_idx
  on public.feedback (workspace_id, published_at desc nulls last);
create index feedback_workspace_entity_idx
  on public.feedback (workspace_id, entity_id);
create index feedback_content_hash_idx
  on public.feedback (workspace_id, content_hash);

create table public.feedback_revisions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  original_text text not null,
  content_hash text not null,
  observed_at timestamptz not null default now(),
  raw_payload jsonb
);

create table public.taxonomy_versions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  version int not null,
  label text not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (workspace_id, version)
);

create table public.topics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  taxonomy_version_id uuid not null references public.taxonomy_versions(id) on delete cascade,
  key text not null,
  name text not null,
  definition text not null,
  domain public.workspace_kind not null,
  status public.topic_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (taxonomy_version_id, key)
);

create table public.classifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  feedback_revision_id uuid references public.feedback_revisions(id) on delete set null,
  taxonomy_version_id uuid references public.taxonomy_versions(id) on delete set null,
  model text not null,
  schema_version text not null,
  status public.classification_status not null,
  is_praise boolean,
  is_complaint boolean,
  is_request boolean,
  is_question boolean,
  is_irrelevant boolean,
  switching_intent boolean,
  severity numeric,
  aspects jsonb not null default '[]'::jsonb,
  probabilities jsonb not null default '{}'::jsonb,
  cache_key text,
  created_at timestamptz not null default now(),
  unique (feedback_id, schema_version, model, taxonomy_version_id)
);

create table public.evidence_spans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classification_id uuid not null references public.classifications(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  sentence_id text,
  start_offset int not null,
  end_offset int not null,
  aspect_key text,
  sentiment text,
  excerpt text not null,
  created_at timestamptz not null default now(),
  check (start_offset >= 0 and end_offset > start_offset)
);

create table public.corrections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  classification_id uuid not null references public.classifications(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  field text not null,
  previous_value jsonb,
  new_value jsonb,
  note text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.collection_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status public.run_status not null default 'queued',
  stage public.run_stage not null default 'discover',
  idempotency_key text not null,
  entity_ids uuid[] not null,
  force_full boolean not null default false,
  progress jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (workspace_id, idempotency_key)
);

create unique index one_active_run_per_workspace
  on public.collection_runs (workspace_id)
  where status in ('queued', 'running');

create table public.run_steps (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid not null references public.collection_runs(id) on delete cascade,
  stage public.run_stage not null,
  idempotency_key text not null,
  status public.run_status not null default 'queued',
  checkpoint jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (run_id, idempotency_key)
);

create table public.provider_calls (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  run_id uuid references public.collection_runs(id) on delete set null,
  provider text not null,
  operation text not null,
  estimated_cost numeric,
  confirmed_usage numeric,
  cache_hit boolean not null default false,
  success boolean not null default false,
  error_code text,
  correlation_id text,
  created_at timestamptz not null default now()
);

create table public.metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  taxonomy_version_id uuid references public.taxonomy_versions(id),
  period_start timestamptz not null,
  period_end timestamptz not null,
  filters jsonb not null default '{}'::jsonb,
  coverage jsonb not null default '{}'::jsonb,
  metrics jsonb not null default '{}'::jsonb,
  formula_version text not null,
  classification_generation text,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create index metric_snapshots_active_lookup
  on public.metric_snapshots (workspace_id, entity_id, period_start, period_end)
  where active;

create table public.comparison_snapshots (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  period_start timestamptz not null,
  period_end timestamptz not null,
  filters jsonb not null default '{}'::jsonb,
  results jsonb not null default '[]'::jsonb,
  formula_version text not null,
  active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete cascade,
  aspect_key text not null,
  title text not null,
  body text not null,
  evidence_ids uuid[] not null default '{}',
  cooldown_until timestamptz,
  created_at timestamptz not null default now()
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid references public.entities(id) on delete set null,
  aspect_key text,
  title text not null,
  description text,
  status public.task_status not null default 'needs_attention',
  owner_user_id uuid references auth.users(id) on delete set null,
  due_date timestamptz,
  priority numeric,
  effort numeric,
  recurring boolean not null default false,
  priority_breakdown jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  task_id uuid not null references public.tasks(id) on delete cascade,
  feedback_id uuid not null references public.feedback(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (task_id, feedback_id)
);

create table public.interventions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  entity_id uuid not null references public.entities(id) on delete cascade,
  description text not null,
  aspect_keys text[] not null,
  implemented_at timestamptz not null,
  washout_days int not null default 0,
  window_days int not null default 28,
  outcome text,
  result jsonb,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  title text not null,
  notes text,
  status public.idea_status not null default 'considering',
  source_feedback_ids uuid[] not null default '{}',
  published_content_item_id uuid references public.content_items(id) on delete set null,
  analysis jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.raw_provider_payloads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider text not null,
  correlation_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create table public.classification_cache (
  cache_key text primary key,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- Membership helper
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

create or replace function public.workspace_role(ws uuid)
returns public.member_role
language sql
stable
security definer
set search_path = public
as $$
  select m.role from public.memberships m
  where m.workspace_id = ws and m.user_id = auth.uid()
  limit 1;
$$;

alter table public.workspaces enable row level security;
alter table public.memberships enable row level security;
alter table public.workspace_entities enable row level security;
alter table public.source_connections enable row level security;
alter table public.content_items enable row level security;
alter table public.feedback enable row level security;
alter table public.feedback_revisions enable row level security;
alter table public.taxonomy_versions enable row level security;
alter table public.topics enable row level security;
alter table public.classifications enable row level security;
alter table public.evidence_spans enable row level security;
alter table public.corrections enable row level security;
alter table public.collection_runs enable row level security;
alter table public.run_steps enable row level security;
alter table public.provider_calls enable row level security;
alter table public.metric_snapshots enable row level security;
alter table public.comparison_snapshots enable row level security;
alter table public.alerts enable row level security;
alter table public.tasks enable row level security;
alter table public.task_evidence enable row level security;
alter table public.interventions enable row level security;
alter table public.content_ideas enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_events enable row level security;
alter table public.raw_provider_payloads enable row level security;
alter table public.classification_cache enable row level security;

-- Entities are shared lookup rows; readable if linked to a member workspace
alter table public.entities enable row level security;

create policy workspaces_select on public.workspaces
  for select using (public.is_workspace_member(id) and deleted_at is null);
create policy workspaces_update on public.workspaces
  for update using (public.workspace_role(id) = 'owner');
create policy workspaces_insert on public.workspaces
  for insert with check (auth.uid() = owner_user_id);

create policy memberships_select on public.memberships
  for select using (public.is_workspace_member(workspace_id));
create policy memberships_manage on public.memberships
  for all using (public.workspace_role(workspace_id) = 'owner');

create policy entities_select on public.entities
  for select using (
    exists (
      select 1 from public.workspace_entities we
      where we.entity_id = entities.id and public.is_workspace_member(we.workspace_id)
    )
  );

-- Generic tenant policies
do $$
declare
  t text;
begin
  foreach t in array array[
    'workspace_entities','source_connections','content_items','feedback','feedback_revisions',
    'taxonomy_versions','topics','classifications','evidence_spans','corrections',
    'collection_runs','run_steps','provider_calls','metric_snapshots','comparison_snapshots',
    'alerts','tasks','task_evidence','interventions','content_ideas','notifications',
    'audit_events','raw_provider_payloads','classification_cache'
  ]
  loop
    execute format(
      'create policy %I_select on public.%I for select using (public.is_workspace_member(workspace_id));',
      t, t
    );
    execute format(
      'create policy %I_write on public.%I for all using (public.workspace_role(workspace_id) in (''owner'',''editor''));',
      t, t
    );
  end loop;
end $$;

-- Viewer-safe writes blocked for corrections/tasks already covered by editor role.
-- Notifications: users see their own
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select using (user_id = auth.uid() and public.is_workspace_member(workspace_id));
