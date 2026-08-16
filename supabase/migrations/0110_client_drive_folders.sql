-- 0110_client_drive_folders.sql
-- Mapa de pastas do Google Drive por cliente (root + subpastas 00–04), criado
-- pela plataforma via escopo drive.file. Leitura/gravação tolerantes no código.
-- { rootId, folders: { "00": id, "01": id, ... } }. Idempotente.

alter table public.clients add column if not exists drive_folders jsonb;
