-- 0093_calendar_meet_link.sql
-- Guarda o link do Google Meet no evento local criado por agendamento público,
-- para exibir na agenda sem depender de re-buscar no Google. O google_event_id
-- (0080) permite deduplicar o evento na visão (local x Google).

alter table public.calendar_events
  add column if not exists meet_link text;

notify pgrst, 'reload schema';
