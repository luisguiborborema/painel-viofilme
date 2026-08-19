-- 0120_meeting_survey_auto.sql
-- Envio automático da pesquisa pós-reunião: liga/desliga + quantas horas após o
-- fim da reunião disparar. Um cron horário lê essa config para decidir o envio.

alter table public.meeting_survey_config
  add column if not exists auto_enabled boolean not null default false,
  add column if not exists delay_hours  integer not null default 2;

notify pgrst, 'reload schema';
