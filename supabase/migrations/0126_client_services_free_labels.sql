-- 0126_client_services_free_labels.sql
-- Serviços do cliente digitados na hora: nome do serviço e plano/formato como
-- texto livre (sem depender do catálogo services/service_plans). Os IDs seguem
-- opcionais (quando o serviço existe no catálogo).

alter table public.client_services
  add column if not exists service_label text,
  add column if not exists plan_label    text;

notify pgrst, 'reload schema';
