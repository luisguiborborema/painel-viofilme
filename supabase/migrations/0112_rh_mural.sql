-- 0112_rh_mural.sql
-- RH & Cultura — Mural (comunicados internos). Antes era mock em rh.ts.

create table if not exists public.rh_announcements (
  id          uuid primary key default gen_random_uuid(),
  author      text,
  author_role text,
  category    text not null default 'operational',   -- 'operational' | 'culture' | 'career'
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists rh_announcements_created_idx on public.rh_announcements (created_at desc);

alter table public.rh_announcements enable row level security;

drop policy if exists "gerencial gerencia mural" on public.rh_announcements;
create policy "gerencial gerencia mural" on public.rh_announcements
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
