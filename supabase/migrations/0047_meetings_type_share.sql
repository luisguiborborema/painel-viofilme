-- 0047_meetings_type_share.sql
-- Agenda (HUB13): tipologia da reunião (tag real, não derivada do título) e
-- flags de compartilhamento de pauta/ata com o cliente no Portal.
-- O vínculo real da tag (violaunch_step / mediaday_session) fica para quando o
-- VioLaunch/VioDay estiverem persistidos.

alter table public.meetings
  add column if not exists type              text,     -- kickoff|monthly|violaunch|media_day|outro
  add column if not exists agenda_shared     boolean not null default false,
  add column if not exists next_steps_shared boolean not null default false;
