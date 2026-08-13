-- 0104_workflows.sql
-- Fluxos de automação estilo HubSpot Workflows: gatilho de inscrição → sequência
-- de ações (criar tarefa, WhatsApp, delay/espera, set-propriedade, notificar),
-- com enrollments (máquina de estado) e log por ação. Idempotente.
--
-- O app lê de forma TOLERANTE (retorna vazio se as tabelas ainda não existem),
-- então o builder aparece mesmo antes desta migração — mas o motor só processa
-- depois de rodar (e de configurar o cron /api/cron/workflows).

create table if not exists public.crm_workflows (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  object_type    text not null default 'deal',
  trigger_type   text not null default 'stage_enter',  -- stage_enter | created
  trigger_config jsonb not null default '{}',          -- { stageKey?, pipelineId? }
  is_active      boolean not null default false,
  created_at     timestamptz not null default now()
);

create table if not exists public.crm_workflow_actions (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references public.crm_workflows(id) on delete cascade,
  position     int not null default 0,
  action_type  text not null,                          -- delay | task | whatsapp | notify | set_property
  config       jsonb not null default '{}',
  created_at   timestamptz not null default now()
);
create index if not exists crm_workflow_actions_wf_idx
  on public.crm_workflow_actions (workflow_id, position);

create table if not exists public.crm_workflow_enrollments (
  id           uuid primary key default gen_random_uuid(),
  workflow_id  uuid not null references public.crm_workflows(id) on delete cascade,
  object_id    uuid not null,
  status       text not null default 'active',         -- active | done | canceled
  current_step int not null default 0,
  next_run_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists crm_workflow_enrollments_due_idx
  on public.crm_workflow_enrollments (status, next_run_at);

create table if not exists public.crm_workflow_action_logs (
  id            uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.crm_workflow_enrollments(id) on delete cascade,
  action_id     uuid,
  status        text not null,                         -- ok | error | skipped
  detail        text,
  ran_at        timestamptz not null default now()
);

-- RLS: gestão total; leitura para autenticados (o motor usa service-role e ignora RLS).
alter table public.crm_workflows enable row level security;
alter table public.crm_workflow_actions enable row level security;
alter table public.crm_workflow_enrollments enable row level security;
alter table public.crm_workflow_action_logs enable row level security;

drop policy if exists crm_workflows_all on public.crm_workflows;
create policy crm_workflows_all on public.crm_workflows
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');
drop policy if exists crm_workflow_actions_all on public.crm_workflow_actions;
create policy crm_workflow_actions_all on public.crm_workflow_actions
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');
drop policy if exists crm_workflow_enrollments_read on public.crm_workflow_enrollments;
create policy crm_workflow_enrollments_read on public.crm_workflow_enrollments
  for select using (public.app_role() = 'gerencial');
drop policy if exists crm_workflow_action_logs_read on public.crm_workflow_action_logs;
create policy crm_workflow_action_logs_read on public.crm_workflow_action_logs
  for select using (public.app_role() = 'gerencial');
