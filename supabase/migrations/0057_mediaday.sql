-- 0057_mediaday.sql
-- HUB12 · VioDay (relatório de Media Day). Fecha o loop do direcionamento de
-- arte "Media Day" da Linha Editorial: planejar → capturar → pós/entrega.
--
-- O checklist de captura NÃO é digitado à mão — é derivado dos posts da LE com
-- art_direction = 'Media Day'. Estas tabelas guardam apenas o ESTADO daquela
-- captação (planejamento da sessão + status/brutos por item).

create table if not exists public.mediaday_sessions (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.clients(id) on delete cascade,
  scheduled_label text,                         -- "28/06 · 09h" (texto livre)
  location        text,
  team            text,
  equipment       text,
  notes           text,
  status          text not null default 'planning', -- planning|ready|shot|delivered
  updated_at      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (client_id)                            -- uma sessão ativa por cliente
);

create table if not exists public.mediaday_items (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid not null references public.clients(id) on delete cascade,
  post_id        uuid references public.editorial_posts(id) on delete cascade,
  task_id        uuid,                          -- delivery task de origem (avança no "capturado")
  capture_status text not null default 'pending',  -- pending|done|reshoot
  footage_status text not null default 'awaiting', -- awaiting|raw_delivered|editing|final
  raw_assets     jsonb not null default '[]'::jsonb,
  notes          text,
  updated_at     timestamptz not null default now(),
  unique (client_id, post_id)                   -- idempotente por post da LE
);

create index if not exists mediaday_items_client_idx on public.mediaday_items (client_id);

alter table public.mediaday_sessions enable row level security;
alter table public.mediaday_items enable row level security;

drop policy if exists "gerencial gerencia mediaday sessions" on public.mediaday_sessions;
create policy "gerencial gerencia mediaday sessions" on public.mediaday_sessions
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

drop policy if exists "gerencial gerencia mediaday items" on public.mediaday_items;
create policy "gerencial gerencia mediaday items" on public.mediaday_items
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
