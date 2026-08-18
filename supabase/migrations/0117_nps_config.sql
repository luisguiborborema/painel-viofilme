-- 0117_nps_config.sql
-- Textos personalizáveis da pesquisa de NPS (linha única). A escala 0–10 é fixa.
-- Leitura na página pública é feita via service-role (bypassa RLS).

create table if not exists public.nps_config (
  id            smallint primary key default 1,
  headline      text,
  intro         text,
  comment_label text,
  thank_you     text,
  updated_at    timestamptz not null default now(),
  constraint nps_config_singleton check (id = 1)
);

insert into public.nps_config (id) values (1) on conflict (id) do nothing;

alter table public.nps_config enable row level security;

drop policy if exists "gerencial gerencia nps_config" on public.nps_config;
create policy "gerencial gerencia nps_config" on public.nps_config
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
