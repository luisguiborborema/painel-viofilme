-- 0070_deal_prospecting.sql
-- Novo negócio (outbound do SDR): anotações de prospecção no próprio negócio
-- (campo livre preenchido no momento zero, antes do contato). Ver decisões da
-- tela "Novo negócio" no viofilme_comercial_roadmap_mestre.

alter table public.crm_leads
  add column if not exists prospecting_notes text;

notify pgrst, 'reload schema';
