-- 0084_delivery_completed_at.sql
-- Métricas de produtividade do Painel de Entregas (estilo Sprint board):
-- registra QUANDO a tarefa foi concluída (entrou na etapa terminal 'done'),
-- para lead time e ranking por período. moved_at passa a ser atualizado a cada
-- mudança de etapa pela API (antes só no insert).

alter table public.delivery_tasks
  add column if not exists completed_at timestamptz;

-- Semeia completed_at para tarefas já concluídas (proxy: última movimentação).
update public.delivery_tasks
  set completed_at = coalesce(moved_at, updated_at)
  where stage = 'done' and completed_at is null;

create index if not exists delivery_tasks_completed_idx
  on public.delivery_tasks (completed_at);

notify pgrst, 'reload schema';
