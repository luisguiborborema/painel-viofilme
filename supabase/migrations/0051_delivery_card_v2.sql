-- 0051_delivery_card_v2.sql
-- Evolução do card de tarefa (Painel de Entregas) — Fase 1 (modelo Sprints):
-- prioridade em 4 níveis, multi-responsável e solicitante.

alter table public.delivery_tasks
  add column if not exists priority  text not null default 'media',  -- baixa|media|alta|urgente
  add column if not exists assignees text[] not null default '{}',
  add column if not exists requester text;                            -- quem pediu (nome)

-- backfill a partir dos campos antigos
update public.delivery_tasks set priority = 'urgente'
  where urgent = true and priority = 'media';
update public.delivery_tasks set assignees = array[assignee]
  where assignee is not null and assignee <> '' and assignees = '{}';
