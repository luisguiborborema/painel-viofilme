-- 0040_client_profile.sql
-- Contatos e briefing do cliente. Fonte real dos campos hoje exibidos como "—"
-- no Raio-X (contato/telefone/e-mail, cidade, CS responsável) e no card de
-- briefing (objetivo, tom de voz, público, concorrentes, restrições).
-- Cadastro manual pelo gerencial. Sem integração externa.

alter table public.clients
  add column if not exists city              text,
  add column if not exists cs_responsavel    text,
  add column if not exists contact_name      text,
  add column if not exists contact_role      text,
  add column if not exists contact_phone     text,
  add column if not exists contact_email     text,
  add column if not exists brief_objetivo    text,
  add column if not exists brief_tom         text,
  add column if not exists brief_publico     text,
  add column if not exists brief_concorrentes text,
  add column if not exists brief_restricoes  text;
