-- 0055_crm_task_priority.sql
-- Card v2 nas Tarefas do CRM: prioridade em 4 níveis (o crm_tasks já tinha
-- multi-responsável e campos custom via properties).

alter table public.crm_tasks
  add column if not exists priority text not null default 'media';  -- baixa|media|alta|urgente
