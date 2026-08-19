-- 0121_calendar_event_client.sql
-- Vincula reuniões da Agenda (calendar_events) a um cliente, para disparar a
-- pesquisa pós-reunião (manual e automática N horas após o fim).

alter table public.calendar_events
  add column if not exists client_id uuid references public.clients(id) on delete set null;

create index if not exists calendar_events_client_idx on public.calendar_events (client_id);

notify pgrst, 'reload schema';
