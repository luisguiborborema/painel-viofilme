-- 0128_drive_root_folder.sql
-- Pasta-mãe do Drive onde as pastas dos clientes são criadas.
--
-- Antes só existia a env GOOGLE_DRIVE_CLIENTS_ROOT (exigia deploy para mudar e,
-- vazia, criava tudo na raiz do "Meu Drive"). Agora fica configurável pela tela
-- de Integrações — ex.: a pasta compartilhada "Gerenciamento".

alter table public.google_connections
  add column if not exists drive_root_folder_id   text,
  add column if not exists drive_root_folder_name text;

notify pgrst, 'reload schema';
