-- 0049_client_deliverables.sql
-- Entregáveis do contrato por formato (origem dos "slots" na Criar LE — Tela 1).
-- Ex.: Reels 4/mês, Feed 6/mês. Nasce no onboarding/VioLaunch; editável no Hub.

create table if not exists public.client_deliverables (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  format       text not null,                 -- Reels | Feed | Stories | Carrossel
  monthly_qty  int not null default 0,
  updated_at   timestamptz not null default now(),
  unique (client_id, format)
);

create index if not exists client_deliverables_client_idx
  on public.client_deliverables (client_id);

alter table public.client_deliverables enable row level security;

drop policy if exists "gerencial gerencia entregaveis" on public.client_deliverables;
create policy "gerencial gerencia entregaveis" on public.client_deliverables
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
