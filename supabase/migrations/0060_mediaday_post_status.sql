-- 0060_mediaday_post_status.sql
-- VioDay (VD03) — pós/entrega é estado GLOBAL do dia, não por item.
-- Estágios: awaiting (aguardando captação) → raw_delivered (brutos entregues)
--           → editing (em edição) → final (entregue final).

alter table public.mediaday_sessions
  add column if not exists post_status text not null default 'awaiting';
