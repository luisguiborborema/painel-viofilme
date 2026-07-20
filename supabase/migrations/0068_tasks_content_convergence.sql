-- 0068_tasks_content_convergence.sql
-- C1.1 (passo 1) — convergência do modelo para a FICHA ÚNICA.
-- Hoje o conteúdo (tema/roteiro/legenda/refs) e as duas datas vivem só em
-- editorial_posts. Para uma delivery_task pura (aberta do Kanban, sem LE) poder
-- renderizar a MESMA ficha canônica, ela precisa ter onde guardar esses campos.
-- Aditivo e seguro: colunas nulas; o que já existe (type, requester, assignees,
-- checklist, comments, priority, duration_min) permanece.

alter table public.delivery_tasks add column if not exists tema                text;
alter table public.delivery_tasks add column if not exists roteiro             text;   -- roteiro/copy (conteúdo)
alter table public.delivery_tasks add column if not exists legenda             text;   -- legenda da publicação
alter table public.delivery_tasks add column if not exists refs                jsonb not null default '[]'::jsonb; -- referências/moodboard
alter table public.delivery_tasks add column if not exists post_date_iso       date;   -- data de postagem
alter table public.delivery_tasks add column if not exists delivery_date       date;   -- prazo de entrega (calculado)
alter table public.delivery_tasks add column if not exists delivery_overridden boolean not null default false;
alter table public.delivery_tasks add column if not exists commemorative_date  text;
