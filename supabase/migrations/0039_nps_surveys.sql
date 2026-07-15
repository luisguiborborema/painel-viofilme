-- 0039_nps_surveys.sql
-- Pesquisas de NPS por cliente. Fonte real do NPS exibido no Hub e no Raio-X
-- do cliente, e sinal do health score. Sem integração externa: registro manual
-- pelo time (CS) após a pesquisa com o cliente.

create table if not exists public.nps_surveys (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  score       smallint not null check (score between 0 and 10),
  comment     text,
  respondent  text,                          -- quem respondeu no cliente (opcional)
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists nps_surveys_client_idx
  on public.nps_surveys (client_id, created_at desc);

alter table public.nps_surveys enable row level security;

-- Só o gerencial registra e lê pesquisas de NPS.
drop policy if exists "gerencial gerencia nps" on public.nps_surveys;
create policy "gerencial gerencia nps" on public.nps_surveys
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
