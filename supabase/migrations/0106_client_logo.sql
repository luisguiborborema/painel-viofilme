-- 0106_client_logo.sql
-- Logo do cliente na ficha (Hub). URL pública do arquivo (bucket wa-media).
-- Leitura tolerante no código (ignora se a coluna ainda não existe), então
-- rodar esta migração só habilita a exibição/gravação. Idempotente.

alter table public.clients add column if not exists logo_url text;
