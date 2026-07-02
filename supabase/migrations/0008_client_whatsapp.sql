-- ============================================================================
-- PAINEL VIOFILME — WhatsApp do cliente (destino das notificações via Uazapi)
-- ============================================================================
alter table public.clients
  add column if not exists whatsapp text;
