-- 0108_editorial_shotlist.sql
-- Decupagem (shotlist) do vídeo por post da linha editorial: lista de linhas
-- { tempo, imagem, legenda } que alimenta a tabela da apresentação (template).
-- Leitura/gravação tolerantes no código (ignoram se a coluna ainda não existe).
-- Idempotente.

alter table public.editorial_posts add column if not exists shotlist jsonb not null default '[]';
