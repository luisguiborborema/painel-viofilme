-- 0105_workflow_enrollment_unique.sql
-- Hardening dos Workflows: impede DUAS inscrições ATIVAS do mesmo negócio no
-- mesmo workflow. O código já checa antes de inserir (anti-duplicação), mas sob
-- concorrência (dois gatilhos simultâneos, ou ticks de cron sobrepostos rodando
-- enrollDateReached) o check-then-insert pode passar duas vezes. Este índice
-- único parcial torna a garantia atômica no banco. Idempotente.
--
-- Só cobre status='active' (parcial): um negócio pode ter várias inscrições
-- 'done'/'canceled' históricas, mas no máximo uma ativa por workflow. O insert
-- perdedor da corrida falha silenciosamente (best-effort) — que é exatamente o
-- comportamento desejado ("já inscrito").

create unique index if not exists crm_workflow_enrollments_active_uq
  on public.crm_workflow_enrollments (workflow_id, object_id)
  where status = 'active';
