-- ============================================================================
-- PAINEL VIOFILME — CRM: automações por estágio
--
-- Ao um negócio ENTRAR num estágio, dispara ações (como workflows do HubSpot).
-- Guardadas em `automations` (jsonb):
--   [{ type: "task",     title, dueDays? }]      → cria tarefa de follow-up
--   [{ type: "whatsapp", message }]              → envia WhatsApp ao contato
--   [{ type: "notify",   message }]              → notifica o time (WhatsApp) +
--                                                  registra na timeline do negócio
-- Executadas no servidor após a mudança de estágio (/api/crm/leads move).
-- ============================================================================
alter table public.crm_stages
  add column if not exists automations jsonb not null default '[]'::jsonb;
