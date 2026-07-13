-- 0036_hour_entries.sql
-- Apontamento de horas → banco de horas real. Cada linha é um lançamento
-- (positivo = extra acumulada; negativo = compensação). O saldo do mês por
-- colaborador é a soma dos lançamentos do mês.

create table if not exists public.hour_entries (
  id         uuid primary key default gen_random_uuid(),
  employee   text not null,             -- nome do colaborador
  work_date  date not null default current_date,
  hours      numeric(6,2) not null default 0,  -- pode ser negativo (compensação)
  note       text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists hour_entries_emp_idx on public.hour_entries (employee, work_date desc);
create index if not exists hour_entries_date_idx on public.hour_entries (work_date desc);

alter table public.hour_entries enable row level security;

-- Só o gerencial gerencia o banco de horas.
drop policy if exists "gerencial gerencia horas" on public.hour_entries;
create policy "gerencial gerencia horas" on public.hour_entries
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
