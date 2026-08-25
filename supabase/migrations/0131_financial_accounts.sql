-- 0131_financial_accounts.sql
-- Contas financeiras (Asaas, BTG, Inter, caixa…) + recebíveis manuais.
--
-- 1) Uma conta por onde o dinheiro entra ou sai. Despesas e recebimentos
--    passam a apontar para ela, o que dá saldo por conta.
-- 2) Recebimento fora do Asaas (PIX, dinheiro, transferência, permuta) passa a
--    caber na MESMA tabela `payments`, com source='manual'. Assim DRE, fluxo de
--    caixa, inadimplência e KPIs já enxergam tudo, sem duplicar lógica.
--    O webhook do Asaas faz upsert por asaas_payment_id, então nunca toca nas
--    linhas manuais (que têm esse campo nulo).

create table if not exists public.financial_accounts (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                       -- "Asaas", "BTG", "Inter"
  kind            text not null default 'banco',       -- banco | gateway | caixa
  institution     text,
  opening_balance numeric(12,2) not null default 0,    -- saldo inicial
  active          boolean not null default true,
  is_default      boolean not null default false,
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists financial_accounts_name_idx
  on public.financial_accounts (lower(name));

alter table public.financial_accounts enable row level security;
drop policy if exists "gerencial gerencia financial_accounts" on public.financial_accounts;
create policy "gerencial gerencia financial_accounts" on public.financial_accounts
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- ── Recebíveis manuais na mesma tabela dos do Asaas ─────────────────────────
-- O id do Asaas passa a ser opcional (lançamento manual não tem).
alter table public.payments alter column asaas_payment_id drop not null;

alter table public.payments
  add column if not exists source     text not null default 'asaas',  -- asaas | manual
  add column if not exists account_id uuid references public.financial_accounts(id) on delete set null,
  add column if not exists note       text;

create index if not exists payments_source_idx  on public.payments (source, due_date desc);
create index if not exists payments_account_idx on public.payments (account_id);

-- Despesas também saem de uma conta.
alter table public.expenses
  add column if not exists account_id uuid references public.financial_accounts(id) on delete set null;

create index if not exists expenses_account_idx on public.expenses (account_id);

-- Semente: a conta do Asaas, que já é a origem dos recebíveis existentes.
insert into public.financial_accounts (name, kind, institution, is_default, position)
select 'Asaas', 'gateway', 'Asaas', true, 0
where not exists (select 1 from public.financial_accounts);

notify pgrst, 'reload schema';
