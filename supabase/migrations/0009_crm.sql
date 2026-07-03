-- ============================================================================
-- PAINEL VIOFILME — Módulo 2: CRM & Vendas (funil de aquisição)
--
-- crm_leads        : oportunidades no funil (BDR / pipeline / ficha do lead).
-- crm_interactions : timeline omni-channel (WhatsApp, e-mail, ligação, nota).
-- crm_tasks        : próximas ações / lista de foco.
--
-- CRM é interno da agência: todas as políticas exigem papel 'gerencial'.
-- A escrita via webhook (WhatsApp/Uazapi) usa service_role (sem sessão).
-- ============================================================================

create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,                       -- empresa/lead (ex.: "Imobiliária Costa Mar")
  contact_name text,
  contact_phone text,                       -- só dígitos (DDI+DDD) p/ casar WhatsApp
  contact_email text,
  segment text,                             -- Imóveis, Saúde, Gastronomia...
  stage text not null default 'prospeccao', -- prospeccao|reuniao|proposta|negociacao|ganho|perdido
  monthly_value numeric(12,2) default 0,    -- valor mensal (MRR potencial)
  media_budget numeric(12,2) default 0,     -- verba de mídia inclusa
  plan text,                                -- "Social Pro + Tráfego"
  probability int default 0,                -- 0..100
  source text,                              -- origem do lead
  owner text,                               -- responsável (BDR/CS)
  bant jsonb not null default '{}'::jsonb,   -- {budget,authority,need,timing}
  next_task_title text,
  next_task_due timestamptz,
  last_interaction_at timestamptz,
  stage_changed_at timestamptz not null default now(),  -- p/ "apodrecimento"
  won_at timestamptz,
  lost_at timestamptz,
  lost_reason text,
  -- destino do "Lead Ganho" (referências geradas pela automação)
  converted_client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_leads_stage_idx on public.crm_leads (stage, stage_changed_at);
create index if not exists crm_leads_phone_idx on public.crm_leads (contact_phone);

create table if not exists public.crm_interactions (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  channel text not null default 'note',     -- whatsapp|email|call|note|system
  direction text,                           -- in|out|null (nota/sistema)
  body text,
  author text,                              -- quem registrou (nome do usuário)
  meta jsonb not null default '{}'::jsonb,   -- ex.: {bant:{...}} p/ /qualificação
  external_id text,                         -- id da mensagem no provedor (idempotência)
  created_at timestamptz not null default now()
);
create index if not exists crm_interactions_lead_idx
  on public.crm_interactions (lead_id, created_at desc);
create unique index if not exists crm_interactions_external_idx
  on public.crm_interactions (channel, external_id)
  where external_id is not null;

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads (id) on delete cascade,
  title text not null,
  due_date timestamptz,
  status text not null default 'pending',   -- pending|done
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists crm_tasks_lead_idx on public.crm_tasks (lead_id);
create index if not exists crm_tasks_due_idx on public.crm_tasks (status, due_date);

-- RLS: CRM é 100% interno (gerencial). Webhook grava via service_role.
alter table public.crm_leads        enable row level security;
alter table public.crm_interactions enable row level security;
alter table public.crm_tasks        enable row level security;

create policy "gerencial gerencia leads" on public.crm_leads
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

create policy "gerencial gerencia interações" on public.crm_interactions
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

create policy "gerencial gerencia tarefas" on public.crm_tasks
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.crm_leads        to anon, authenticated, service_role;
grant all on public.crm_interactions to anon, authenticated, service_role;
grant all on public.crm_tasks        to anon, authenticated, service_role;
