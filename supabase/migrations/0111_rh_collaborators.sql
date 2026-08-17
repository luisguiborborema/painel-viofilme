-- 0111_rh_collaborators.sql
-- RH & Cultura — cadastro real de colaboradores (antes era mock em rh.ts).
-- Cada linha é um colaborador do time (CLT/PJ). Banco de horas real continua
-- em hour_entries (por nome); aqui é o cadastro/roster editável.

create table if not exists public.collaborators (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  role            text,
  squad           text,
  contract_type   text not null default 'clt',          -- 'clt' | 'pj'
  salary          numeric(12,2),
  admission_date  text,                                  -- livre (ex.: "jan/24")
  email           text,
  phone           text,
  vacation_due    text,
  vacation_soon   boolean not null default false,
  weekly_load_pct integer not null default 0,
  hour_balance    numeric(6,2) not null default 0,
  hour_limit      numeric(6,2) not null default 8,
  pdi_active      boolean not null default false,
  review_pending  boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists collaborators_name_idx on public.collaborators (name);

alter table public.collaborators enable row level security;

-- Só o gerencial gerencia o time.
drop policy if exists "gerencial gerencia colaboradores" on public.collaborators;
create policy "gerencial gerencia colaboradores" on public.collaborators
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
