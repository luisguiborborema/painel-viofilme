-- 0061_vioflux_posts.sql
-- VioFlux (FLX01) — visão de PUBLICAÇÃO sobre as tasks. Não é base de conteúdo
-- paralela: cada linha aponta para a task/post de origem (task_id / editorial_post_id)
-- e carrega só os campos EXTRAS de publicação (rede, agendamento-espelho, estado).
--
-- Fase atual = modo MANUAL: o agendamento é espelho (não dispara publicação) e
-- "Publicado" é marcado à mão. A automação liga quando a App Review da Meta passar.

create table if not exists public.vioflux_posts (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid not null references public.clients(id) on delete cascade,
  task_id           uuid,   -- delivery task de origem (fonte única)
  editorial_post_id uuid references public.editorial_posts(id) on delete set null,
  title             text not null,
  caption           text,
  format            text not null default 'Feed',
  networks          text[] not null default '{instagram}',
  state             text not null default 'rascunho',  -- rascunho|aguardando|aprovado|ajuste|agendado|publicado|falha
  scheduled_at      timestamptz,                       -- espelho do combinado (NÃO publica)
  media_note        text,
  client_comment    text,
  created_by        uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists vioflux_posts_client_idx on public.vioflux_posts (client_id, created_at desc);
create index if not exists vioflux_posts_state_idx  on public.vioflux_posts (state);

alter table public.vioflux_posts enable row level security;

drop policy if exists "gerencial gerencia vioflux" on public.vioflux_posts;
create policy "gerencial gerencia vioflux" on public.vioflux_posts
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

-- Cliente lê os próprios posts (forward-ready para a aprovação no Portal).
drop policy if exists "cliente lê seus posts vioflux" on public.vioflux_posts;
create policy "cliente lê seus posts vioflux" on public.vioflux_posts
  for select using (client_id = public.app_client_id());
