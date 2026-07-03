-- ============================================================================
-- PAINEL VIOFILME — Seleção de calendários do Google
--
-- calendar_id      : calendário onde os eventos são CRIADOS (write).
-- read_calendar_ids: calendários exibidos na Agenda/dashboard (read). Vazio =
--                    usa apenas o calendar_id.
-- ============================================================================

alter table public.google_connections
  add column if not exists read_calendar_ids jsonb not null default '[]'::jsonb;
