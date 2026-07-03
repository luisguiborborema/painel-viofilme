-- ============================================================================
-- PAINEL VIOFILME — CRM: metas de venda por responsável/mês
--
-- crm_goals: meta de MRR novo por vendedor num mês (YYYY-MM). O forecast
-- (ganho no mês + pipeline ponderado) é calculado a partir de crm_leads.
-- ============================================================================
create table if not exists public.crm_goals (
  id uuid primary key default gen_random_uuid(),
  owner text not null,
  month text not null,              -- 'YYYY-MM'
  target numeric(12,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists crm_goals_owner_month_idx
  on public.crm_goals (owner, month);

alter table public.crm_goals enable row level security;

drop policy if exists "gerencial gerencia crm_goals" on public.crm_goals;
create policy "gerencial gerencia crm_goals" on public.crm_goals
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.crm_goals to anon, authenticated, service_role;
