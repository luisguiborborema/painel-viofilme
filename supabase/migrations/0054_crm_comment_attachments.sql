-- 0054_crm_comment_attachments.sql
-- Propaga o card v2 ao CRM: anexos nos comentários (o CRM já tinha threads e
-- reações; faltava anexo). Arquivos vão para o bucket wa-media/task-files.

alter table public.crm_comments
  add column if not exists attachments jsonb not null default '[]'::jsonb;  -- [{name,url}]
