-- 0125_broadcasts_v2.sql
-- Disparos v2: instância/atendente, tipo de mensagem, intervalo min/max (anti-ban),
-- reescrita com IA e variáveis por destinatário (planilha CSV/XLSX).

alter table public.broadcasts
  add column if not exists instance_token   text,
  add column if not exists instance_name    text,
  add column if not exists msg_type         text not null default 'text', -- text|image|video|audio|document
  add column if not exists delay_min_seconds integer not null default 3,
  add column if not exists delay_max_seconds integer not null default 8,
  add column if not exists ai_rewrite        boolean not null default false;

-- Variáveis por destinatário (colunas extras da planilha viram {cabecalho}).
alter table public.broadcast_recipients
  add column if not exists vars jsonb not null default '{}'::jsonb;

notify pgrst, 'reload schema';
