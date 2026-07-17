-- 0045_editorial_post_fields.sql
-- Campos da ficha do post (Tela 3 — Task universal): tema, responsáveis e
-- prioridade. Conteúdo (roteiro/legenda) já existe; a execução (status,
-- checklist, comentários) vive na delivery_task vinculada quando gerada.

alter table public.editorial_posts
  add column if not exists tema               text,
  add column if not exists assignee           text,   -- responsável principal (id do time)
  add column if not exists assignee_secondary text,   -- responsável secundário (opcional)
  add column if not exists priority           text not null default 'normal';  -- normal | urgente
