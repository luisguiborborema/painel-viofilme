-- 0059_delivery_config.sql
-- Painel de Entregas — configurabilidade prescrita pelo spec.
-- ENT10: task_types (duração padrão por tipo, base da Timeline).
-- ENT12: capacidade compartilhada (nº de tasks/dia por pessoa) configurável.

create table if not exists public.task_types (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null unique,          -- casa com delivery_tasks.type
  default_duration_min integer not null default 60,
  sort                 integer not null default 0,
  created_at           timestamptz not null default now()
);

-- Override por task (herda o default do tipo quando nulo).
alter table public.delivery_tasks add column if not exists duration_min integer;

-- Config single-row (id fixo = 1).
create table if not exists public.delivery_settings (
  id               integer primary key default 1 check (id = 1),
  capacity_per_day integer not null default 4,
  updated_at       timestamptz not null default now()
);

-- Seed dos tipos e durações default (idempotente).
insert into public.task_types (name, default_duration_min, sort) values
  ('Arte', 90, 1),
  ('Vídeo', 180, 2),
  ('Copy', 45, 3),
  ('Tráfego', 60, 4)
on conflict (name) do nothing;

insert into public.delivery_settings (id, capacity_per_day)
values (1, 4)
on conflict (id) do nothing;

alter table public.task_types       enable row level security;
alter table public.delivery_settings enable row level security;

drop policy if exists "gerencial gerencia task_types" on public.task_types;
create policy "gerencial gerencia task_types" on public.task_types
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

drop policy if exists "gerencial gerencia delivery_settings" on public.delivery_settings;
create policy "gerencial gerencia delivery_settings" on public.delivery_settings
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
