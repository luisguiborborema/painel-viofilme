-- 0122_diagnostics.sql
-- Módulo Diagnóstico (comercial + entregas): questionário interno preenchido em
-- reunião pelo time → vira um documento. Perguntas configuráveis (linha única).

create table if not exists public.diagnostic_config (
  id         smallint primary key default 1,
  questions  jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  constraint diagnostic_config_singleton check (id = 1)
);
insert into public.diagnostic_config (id) values (1) on conflict (id) do nothing;

create table if not exists public.diagnostics (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references public.clients(id) on delete set null,
  lead_id     uuid references public.crm_leads(id) on delete set null,
  subject     text not null,                 -- nome do cliente/empresa (exibição)
  title       text not null default 'Diagnóstico',
  answers     jsonb not null default '{}'::jsonb,   -- { questionId: valor }
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists diagnostics_created_idx on public.diagnostics (created_at desc);
create index if not exists diagnostics_client_idx on public.diagnostics (client_id);
create index if not exists diagnostics_lead_idx on public.diagnostics (lead_id);

alter table public.diagnostic_config enable row level security;
alter table public.diagnostics enable row level security;

drop policy if exists "gerencial gerencia diag config" on public.diagnostic_config;
create policy "gerencial gerencia diag config" on public.diagnostic_config
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

drop policy if exists "gerencial gerencia diagnosticos" on public.diagnostics;
create policy "gerencial gerencia diagnosticos" on public.diagnostics
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
