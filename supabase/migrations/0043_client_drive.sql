-- 0043_client_drive.sql
-- Link da pasta de ativos do cliente (Google Drive u outro). Alimenta a ação
-- rápida "Drive de ativos" na head. Cadastro manual pelo gerencial — sem
-- OAuth de Drive: é só o endereço da pasta compartilhada.

alter table public.clients
  add column if not exists drive_folder_url text;
