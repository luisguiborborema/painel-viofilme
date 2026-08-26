-- 0135_account_transfers.sql
-- Transferências entre contas.
--
-- Ao criar as contas (0131) ficou um buraco: mover dinheiro do Asaas para o BTG
-- não era registrável, então o saldo de ambas ficava errado assim que houvesse
-- uma transferência real. Não dá para representar isso como receita/despesa —
-- seria receita e custo falsos, e sujaria o DRE.

create table if not exists public.account_transfers (
  id           uuid primary key default gen_random_uuid(),
  from_account uuid not null references public.financial_accounts(id) on delete cascade,
  to_account   uuid not null references public.financial_accounts(id) on delete cascade,
  amount       numeric(12,2) not null check (amount > 0),
  date         date not null default current_date,
  note         text,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint account_transfers_contas_distintas check (from_account <> to_account)
);

create index if not exists account_transfers_date_idx on public.account_transfers (date desc);
create index if not exists account_transfers_from_idx on public.account_transfers (from_account);
create index if not exists account_transfers_to_idx   on public.account_transfers (to_account);

alter table public.account_transfers enable row level security;
drop policy if exists "gerencial gerencia account_transfers" on public.account_transfers;
create policy "gerencial gerencia account_transfers" on public.account_transfers
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
