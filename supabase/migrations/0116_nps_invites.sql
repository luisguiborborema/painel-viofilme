-- 0116_nps_invites.sql
-- NPS por link público (estilo Tally) + envio trimestral automático.
-- Estende nps_surveys: um convite nasce "pending" (sem nota) com um token
-- público; quando o cliente responde, vira "answered" com a nota.

alter table public.nps_surveys
  add column if not exists public_token uuid default gen_random_uuid(),
  add column if not exists status       text not null default 'answered',   -- pending | answered
  add column if not exists channel      text,                               -- whatsapp | email | manual
  add column if not exists sent_at      timestamptz,
  add column if not exists answered_at  timestamptz;

-- Convites pendentes ainda não têm nota.
alter table public.nps_surveys alter column score drop not null;

create unique index if not exists nps_surveys_token_idx on public.nps_surveys (public_token);
create index if not exists nps_surveys_status_idx on public.nps_surveys (client_id, status, created_at desc);

notify pgrst, 'reload schema';
