-- 0038_delivery_task_details.sql
-- Detalhes da tarefa de entrega persistidos: checklist e comentários internos.
-- Guardados como jsonb na própria linha (escopo da tarefa, volume pequeno).
-- logged_h já existe (0037) para o apontamento de horas.

alter table public.delivery_tasks
  add column if not exists checklist jsonb not null default '[]'::jsonb,
  add column if not exists comments  jsonb not null default '[]'::jsonb;
