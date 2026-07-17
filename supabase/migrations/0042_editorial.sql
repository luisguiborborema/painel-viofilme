-- 0042_editorial.sql
-- Persistência da Linha Editorial: a linha do mês (cabeçalho estratégico +
-- estágio) e seus posts. Post e task são o mesmo objeto que muda de fase — o
-- post pode gerar uma delivery_task de produção (origem "Linha editorial").
-- Gestão pelo gerencial; sem integração externa.

create table if not exists public.editorial_lines (
  id                  uuid primary key default gen_random_uuid(),
  client_id           uuid not null references public.clients(id) on delete cascade,
  month               text not null,                         -- "Julho/2026"
  stage               text not null default 'ideacao',       -- EditorialStage
  objetivo            text,
  narrativa_central   text,
  tensao_narrativa    text,
  datas_comemorativas text,
  pillars             jsonb not null default '[]'::jsonb,     -- [{name,posts,color}]
  moodboard           jsonb not null default '[]'::jsonb,     -- EditorialRef[]
  created_by          uuid references auth.users(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists editorial_lines_client_idx
  on public.editorial_lines (client_id, created_at desc);

create table if not exists public.editorial_posts (
  id             uuid primary key default gen_random_uuid(),
  line_id        uuid not null references public.editorial_lines(id) on delete cascade,
  n              int not null default 0,
  title          text not null default '',
  format         text not null default 'Feed',               -- Feed|Reels|Stories|Carrossel
  pillar         text,
  description    text,                                        -- roteiro/copy
  legenda        text,
  art_direction  text not null default 'Banco do cliente',
  post_date      text,                                        -- "01/07"
  weekday        text,
  refs           jsonb not null default '[]'::jsonb,          -- EditorialRef[]
  task_id        uuid references public.delivery_tasks(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists editorial_posts_line_idx
  on public.editorial_posts (line_id, n);

alter table public.editorial_lines enable row level security;
alter table public.editorial_posts enable row level security;

drop policy if exists "gerencial gerencia LE" on public.editorial_lines;
create policy "gerencial gerencia LE" on public.editorial_lines
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

drop policy if exists "gerencial gerencia posts LE" on public.editorial_posts;
create policy "gerencial gerencia posts LE" on public.editorial_posts
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
