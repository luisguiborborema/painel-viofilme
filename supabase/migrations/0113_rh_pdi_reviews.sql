-- 0113_rh_pdi_reviews.sql
-- RH & Cultura — PDIs (objetivos de desenvolvimento) e Avaliações. Antes mock.

create table if not exists public.rh_pdis (
  id                uuid primary key default gen_random_uuid(),
  collaborator_id   uuid references public.collaborators(id) on delete set null,
  collaborator_name text not null,
  role              text,
  title             text not null,
  indicator         text,
  progress          text,
  status            text not null default 'in_progress',  -- not_started|in_progress|done|missed
  deadline          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.rh_reviews (
  id                uuid primary key default gen_random_uuid(),
  collaborator_id   uuid references public.collaborators(id) on delete set null,
  collaborator_name text not null,
  role              text,
  cycle             text,
  self_score        numeric(3,1) not null default 0,
  leader_score      numeric(3,1) not null default 0,
  note              text,
  status            text not null default 'pending',       -- pending|self_done|done
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

alter table public.rh_pdis    enable row level security;
alter table public.rh_reviews enable row level security;

drop policy if exists "gerencial gerencia pdis" on public.rh_pdis;
create policy "gerencial gerencia pdis" on public.rh_pdis
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

drop policy if exists "gerencial gerencia reviews" on public.rh_reviews;
create policy "gerencial gerencia reviews" on public.rh_reviews
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
