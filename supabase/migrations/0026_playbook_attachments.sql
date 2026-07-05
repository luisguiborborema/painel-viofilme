-- ============================================================================
-- PAINEL VIOFILME — Anexos em playbooks (PDF, imagem, etc.)
--
-- Cada playbook pode ter arquivos anexados (PDF/imagem/…), guardados no
-- Storage (bucket público "playbook-files"). Os metadados ficam em jsonb:
--   [{ id, name, url, contentType, size }]
-- ============================================================================
alter table public.playbooks
  add column if not exists attachments jsonb not null default '[]'::jsonb;
