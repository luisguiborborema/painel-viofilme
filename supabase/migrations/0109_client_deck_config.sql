-- 0109_client_deck_config.sql
-- Textos personalizáveis da apresentação da Linha Editorial (slides Método e
-- Guia de produção) por cliente. Leitura/gravação tolerantes no código (caem no
-- template quando a coluna não existe). Idempotente.

alter table public.clients add column if not exists deck_config jsonb;
