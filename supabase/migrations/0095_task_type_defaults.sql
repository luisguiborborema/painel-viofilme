-- Padrões por tipo de tarefa (usados na criação via formulário/briefing):
-- responsável padrão (evita tarefa órfã) + SLA em dias úteis (prazo automático).
alter table public.task_types
  add column if not exists default_assignee text,
  add column if not exists sla_days integer;
