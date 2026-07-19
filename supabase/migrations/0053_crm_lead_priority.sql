-- 0053_crm_lead_priority.sql
-- Propaga o card v2 ao CRM: prioridade do negócio em 4 níveis (o CRM já tinha
-- multi-responsável, campos custom, histórico de estágio e comentários com
-- threads/reações — faltava só a prioridade).

alter table public.crm_leads
  add column if not exists priority text not null default 'media';  -- baixa|media|alta|urgente
