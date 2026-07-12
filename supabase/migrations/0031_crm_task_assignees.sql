-- 0031_crm_task_assignees.sql
-- Múltiplos responsáveis por tarefa. `assignee` (texto) segue como o primário
-- (= assignees[0]) para retrocompatibilidade com telas/cron que já leem ele.

alter table public.crm_tasks
  add column if not exists assignees text[] not null default '{}'::text[];

-- Backfill: quem já tinha responsável vira o primeiro da lista.
update public.crm_tasks
  set assignees = array[assignee]
  where assignee is not null and assignee <> '' and (assignees is null or cardinality(assignees) = 0);
