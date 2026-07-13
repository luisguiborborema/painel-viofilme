-- 0035_expenses.sql
-- Contas a pagar / despesas da agência. Alimenta o DRE gerencial (custos reais)
-- e a aba "Contas a pagar". Sem integração externa: lançamento manual.

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  description text not null,
  category    text not null default 'outros',  -- salarios|ferramentas|comissoes|impostos|variavel|outros
  amount      numeric(12,2) not null default 0,
  due_date    date,
  paid_date   date,
  status      text not null default 'pending',  -- pending | paid
  recurring   boolean not null default false,
  vendor      text,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists expenses_due_idx on public.expenses (due_date desc);
create index if not exists expenses_status_idx on public.expenses (status);

alter table public.expenses enable row level security;

-- Só o gerencial gerencia despesas (leitura e escrita).
drop policy if exists "gerencial gerencia despesas" on public.expenses;
create policy "gerencial gerencia despesas" on public.expenses
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
