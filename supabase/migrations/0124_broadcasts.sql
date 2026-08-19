-- 0124_broadcasts.sql
-- Disparos em massa (WhatsApp): campanhas para clientes, leads, lista manual e grupos.
-- Processamento em lotes com intervalo anti-ban. Agendamento roda via Supabase
-- (pg_cron + pg_net) chamando /api/broadcasts/process — sem depender de cron da Vercel.

create table if not exists public.broadcasts (
  id            uuid primary key default gen_random_uuid(),
  title         text not null default 'Disparo',
  message       text not null default '',
  media_url     text,
  media_type    text,                          -- image | video | document
  delay_seconds integer not null default 8,    -- intervalo entre envios (anti-ban)
  status        text not null default 'draft', -- draft | scheduled | sending | done | paused
  scheduled_for timestamptz,
  total         integer not null default 0,
  sent          integer not null default 0,
  failed        integer not null default 0,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

create table if not exists public.broadcast_recipients (
  id           uuid primary key default gen_random_uuid(),
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  kind         text not null default 'number', -- number | group
  target       text not null,                  -- dígitos (número) ou JID do grupo (…@g.us)
  name         text,
  status       text not null default 'pending',-- pending | sent | failed | skipped
  error        text,
  sent_at      timestamptz
);

create index if not exists idx_broadcast_recipients_bid on public.broadcast_recipients(broadcast_id);
create index if not exists idx_broadcast_recipients_pending on public.broadcast_recipients(broadcast_id) where status = 'pending';
create index if not exists idx_broadcasts_due on public.broadcasts(status, scheduled_for);

alter table public.broadcasts enable row level security;
alter table public.broadcast_recipients enable row level security;

drop policy if exists "gerencial gerencia broadcasts" on public.broadcasts;
create policy "gerencial gerencia broadcasts" on public.broadcasts
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

drop policy if exists "gerencial gerencia broadcast_recipients" on public.broadcast_recipients;
create policy "gerencial gerencia broadcast_recipients" on public.broadcast_recipients
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';

-- ─────────────────────────────────────────────────────────────────────────────
-- AGENDAMENTO (opcional, roda no Supabase — dispensa cron da Vercel).
-- Rode UMA VEZ, ajustando a URL do app e o CRON_SECRET. Requer as extensões
-- pg_cron e pg_net habilitadas (Dashboard → Database → Extensions).
--
--   select cron.schedule(
--     'process-broadcasts',
--     '* * * * *',                       -- de minuto em minuto
--     $$
--       select net.http_post(
--         url     := 'https://SEU-APP.vercel.app/api/broadcasts/process',
--         headers := jsonb_build_object('Authorization', 'Bearer SEU_CRON_SECRET')
--       );
--     $$
--   );
--
-- Para desligar:  select cron.unschedule('process-broadcasts');
-- ─────────────────────────────────────────────────────────────────────────────
