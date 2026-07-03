-- ============================================================================
-- PAINEL VIOFILME — Metas por cliente (Gestão à Vista / termômetro)
--
-- client_goals: meta de uma métrica para um cliente numa competência (mês).
-- Pré-requisito do "saudável vs. em risco" da Gestão à Vista.
-- ============================================================================

create table if not exists public.client_goals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  metric text not null,            -- conversions|revenue|cpl|roas|followers_growth|engagement_rate
  target_value numeric(14,2) not null default 0,
  period text not null,            -- competência 'YYYY-MM'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, metric, period)
);
create index if not exists client_goals_client_period_idx
  on public.client_goals (client_id, period);

alter table public.client_goals enable row level security;

create policy "gerencial gerencia metas" on public.client_goals
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.client_goals to anon, authenticated, service_role;
