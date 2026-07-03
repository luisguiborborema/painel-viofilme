-- ============================================================================
-- PAINEL VIOFILME — Central de Relatórios: updates recorrentes + envios (REL02/06)
--
-- recurring_updates      : configuração de update automático por cliente.
-- recurring_update_logs  : histórico de cada disparo (auditoria).
-- report_sends           : histórico de ENVIOS (relatório manual + updates).
--
-- Interno da agência (gerencial). Disparo/cron grava via service_role.
-- ============================================================================

create table if not exists public.recurring_updates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  metrics jsonb not null default '[]'::jsonb,   -- ['followers_growth','reach',...]
  recurrence text not null,                     -- 'daily' | 'weekly:{0-6}' | 'monthly:{1-31}'
  channel text not null default 'whatsapp',
  recipient text not null default 'client',     -- vai ao WhatsApp do cliente
  status text not null default 'active',        -- active | paused
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists recurring_updates_client_idx on public.recurring_updates (client_id);
create index if not exists recurring_updates_status_idx on public.recurring_updates (status);

create table if not exists public.recurring_update_logs (
  id uuid primary key default gen_random_uuid(),
  update_id uuid not null references public.recurring_updates (id) on delete cascade,
  sent_at timestamptz not null default now(),
  payload jsonb,
  delivery_status text                          -- sent | failed
);
create index if not exists recurring_update_logs_update_idx
  on public.recurring_update_logs (update_id, sent_at desc);

create table if not exists public.report_sends (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete set null,
  kind text not null default 'report',          -- report | update
  channel text not null default 'whatsapp',
  recipient text,                               -- número/destino
  sent_by text,                                 -- nome do analista ou 'automático'
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists report_sends_time_idx on public.report_sends (created_at desc);

alter table public.recurring_updates     enable row level security;
alter table public.recurring_update_logs enable row level security;
alter table public.report_sends          enable row level security;

create policy "gerencial gerencia updates" on public.recurring_updates
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
create policy "gerencial lê logs de update" on public.recurring_update_logs
  for select using (public.app_role() = 'gerencial');
create policy "gerencial gerencia envios" on public.report_sends
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.recurring_updates     to anon, authenticated, service_role;
grant all on public.recurring_update_logs to anon, authenticated, service_role;
grant all on public.report_sends          to anon, authenticated, service_role;
