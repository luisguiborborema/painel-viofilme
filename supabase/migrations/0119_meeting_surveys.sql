-- 0119_meeting_surveys.sql
-- Pesquisa de satisfação PÓS-REUNIÃO (link público estilo Tally). Escala 1–5
-- estrelas. Espelha o NPS, mas voltada à reunião. Leitura pública via service-role.

create table if not exists public.meeting_surveys (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references public.clients(id) on delete cascade,
  rating       smallint check (rating between 1 and 5),   -- nulo enquanto "pending"
  comment      text,
  extra        jsonb,                                      -- respostas às perguntas extras
  respondent   text,
  public_token uuid default gen_random_uuid(),
  status       text not null default 'answered',           -- pending | answered
  channel      text,                                        -- whatsapp | email | manual
  meeting_ref  text,                                        -- referência livre da reunião (opcional)
  sent_at      timestamptz,
  answered_at  timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create unique index if not exists meeting_surveys_token_idx on public.meeting_surveys (public_token);
create index if not exists meeting_surveys_client_idx on public.meeting_surveys (client_id, created_at desc);

alter table public.meeting_surveys enable row level security;
drop policy if exists "gerencial gerencia pesquisa reuniao" on public.meeting_surveys;
create policy "gerencial gerencia pesquisa reuniao" on public.meeting_surveys
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- Textos + perguntas extras (linha única).
create table if not exists public.meeting_survey_config (
  id            smallint primary key default 1,
  headline      text,
  intro         text,
  comment_label text,
  thank_you     text,
  questions     jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now(),
  constraint meeting_survey_config_singleton check (id = 1)
);
insert into public.meeting_survey_config (id) values (1) on conflict (id) do nothing;

alter table public.meeting_survey_config enable row level security;
drop policy if exists "gerencial gerencia config reuniao" on public.meeting_survey_config;
create policy "gerencial gerencia config reuniao" on public.meeting_survey_config
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
