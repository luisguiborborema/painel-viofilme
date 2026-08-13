-- Sugestões de ajustes do time (feedback board): texto + anexos (imagens/vídeos).
create table if not exists public.suggestions (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text,
  title       text not null,
  description text,
  status      text not null default 'aberta',   -- aberta | em_analise | planejada | concluida | recusada
  attachments jsonb not null default '[]'::jsonb, -- [{url, type: image|video|file, name}]
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists suggestions_created_idx on public.suggestions (created_at desc);

alter table public.suggestions enable row level security;

drop policy if exists "gerencial gerencia sugestões" on public.suggestions;
create policy "gerencial gerencia sugestões" on public.suggestions
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.suggestions to anon, authenticated, service_role;
