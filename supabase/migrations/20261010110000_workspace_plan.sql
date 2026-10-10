alter table public.workspaces
  add column if not exists plan text not null default 'base';

alter table public.workspaces
  drop constraint if exists workspaces_plan_check;

alter table public.workspaces
  add constraint workspaces_plan_check check (plan in ('base', 'pro'));

-- Base plan analyses the newest 200 reviews per entity (you and each competitor).
-- Pro analyses the newest 2,000.
update public.workspaces
set retrieval_budget = case when plan = 'pro' then 2000 else 200 end
where retrieval_budget is distinct from case when plan = 'pro' then 2000 else 200 end;
