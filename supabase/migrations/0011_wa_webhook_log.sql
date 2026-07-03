-- ============================================================================
-- PAINEL VIOFILME — Log de diagnóstico do webhook Uazapi (inbox)
-- Guarda o payload cru de cada chamada recebida, com uma nota do que aconteceu
-- (processado / ignorado / secret inválido). Útil para acertar o parser.
-- Pode ser removida depois que o inbox estiver estável.
-- ============================================================================

create table if not exists public.wa_webhook_log (
  id uuid primary key default gen_random_uuid(),
  raw jsonb,
  note text,
  received_at timestamptz not null default now()
);
create index if not exists wa_webhook_log_time_idx
  on public.wa_webhook_log (received_at desc);

alter table public.wa_webhook_log enable row level security;

create policy "gerencial lê webhook log" on public.wa_webhook_log
  for select using (public.app_role() = 'gerencial');

grant all on public.wa_webhook_log to anon, authenticated, service_role;
