-- 0151_caixa.sql
-- O que a página de Caixa precisa e o núcleo ainda não tinha (spec §15).
--
-- A página tem duas naturezas, e cada uma pede uma coisa do banco:
--
--  1) GERENCIAL — "vou ter dinheiro?". Isso pede que cada movimentação saiba a
--     que BLOCO do fluxo pertence (operacional, investimento, sócios, entre
--     contas). "O caixa caiu R$ 60 mil" tem significados opostos se foi
--     operação, compra de câmera ou distribuição aos sócios, e hoje as três
--     coisas são indistinguíveis depois de somadas.
--
--  2) DE CONTROLE — "o que está no sistema bate com o banco?". Isso pede a
--     CONFERÊNCIA DE SALDO (`balance_checkpoints`) e o registro das
--     IMPORTAÇÕES (`statement_imports`). A conciliação garante que cada
--     movimentação foi explicada; a conferência garante que nenhuma ficou de
--     fora e nenhuma foi contada duas vezes — são controles diferentes, e sem
--     o segundo o saldo pode estar errado com a fila zerada.

/* ══ 1. Bloco e linha do fluxo, por categoria (§2.2 e §15.5) ════════════ */

alter table public.expense_categories
  -- Derivado do `impact_type`, mas sobrescrevível: uma transferência para a
  -- reserva é despesa nenhuma, e só quem conhece a conta sabe disso.
  add column if not exists cash_flow_group text
    check (cash_flow_group in ('operating', 'investing', 'financing', 'internal')),
  add column if not exists cash_flow_line text;

-- Preenche pelo tipo de impacto já existente. Conservador: o que não se sabe
-- classificar vira operacional, que é onde a maioria está.
update public.expense_categories
   set cash_flow_group = case impact_type
         when 'investment'       then 'investing'
         when 'equity_financing' then 'financing'
         else 'operating'
       end
 where cash_flow_group is null;

update public.expense_categories
   set cash_flow_line = case impact_type
         when 'operating_revenue'  then 'recebimentos'
         when 'revenue_deduction'  then 'impostos'
         when 'direct_cost'        then 'diretos'
         when 'financial_result'   then 'financeiro'
         when 'investment'         then 'equipamentos'
         when 'equity_financing'   then 'socios'
         else 'estrutura'
       end
 where cash_flow_line is null;

/* ══ 2. Conferência de saldo (§2.1 e §15.1) ═════════════════════════════ */

create table if not exists public.balance_checkpoints (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.financial_accounts(id) on delete cascade,
  date          date not null,
  bank_balance_cents   bigint not null,
  -- Gravado no momento da conferência: o saldo calculado MUDA quando chegam
  -- movimentações antigas, e guardar o valor da época é o que permite dizer
  -- depois "a diferença era das movimentações que faltavam".
  system_balance_cents bigint not null default 0,
  difference_cents     bigint not null default 0,
  source        text not null default 'manual'
                check (source in ('ofx', 'manual', 'integration')),
  status        text not null default 'open'
                check (status in ('matched', 'open', 'adjusted')),
  adjustment_transaction_id uuid references public.transactions(id) on delete set null,
  resolved_by   text,
  resolved_at   timestamptz,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists balance_checkpoints_conta_idx
  on public.balance_checkpoints (account_id, date desc);

/* ══ 3. Importações de extrato (§7 e §15.2) ═════════════════════════════ */

create table if not exists public.statement_imports (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.financial_accounts(id) on delete cascade,
  file_name     text not null,
  period_start  date,
  period_end    date,
  rows_total    integer not null default 0,
  rows_new      integer not null default 0,
  rows_duplicated integer not null default 0,
  rows_confirming integer not null default 0,
  -- `undone` em vez de apagar a linha: saber que uma importação foi desfeita
  -- é metade da explicação quando o saldo muda sem ninguém entender.
  status        text not null default 'active' check (status in ('active', 'undone')),
  imported_by   text,
  imported_at   timestamptz not null default now(),
  undone_at     timestamptz
);
create index if not exists statement_imports_conta_idx
  on public.statement_imports (account_id, imported_at desc);

/* ══ 4. Campos em transactions (§15.3) ══════════════════════════════════ */

alter table public.transactions
  -- A descrição do banco nunca é alterada; a interpretada é derivada dela na
  -- importação. Guardar as duas é o que permite corrigir a interpretação sem
  -- perder o que o banco de fato escreveu.
  add column if not exists description_clean text,
  add column if not exists counterparty_name text,
  add column if not exists import_id uuid references public.statement_imports(id) on delete set null,
  add column if not exists bank_reference text,
  add column if not exists ignored_by text,
  add column if not exists ignored_at timestamptz;

create index if not exists transactions_conta_data_idx
  on public.transactions (financial_account_id, date desc);

/* ══ 5. Transferências entre contas (§11.2) ═════════════════════════════ */

create table if not exists public.transfers (
  id            uuid primary key default gen_random_uuid(),
  from_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  to_account_id   uuid not null references public.financial_accounts(id) on delete cascade,
  date          date not null,
  amount_cents  bigint not null check (amount_cents > 0),
  -- Os dois lados da transferência: cada um é uma movimentação própria, e é
  -- o par que impede a transferência de virar receita numa conta e despesa na
  -- outra quando alguém olhar só um lado.
  from_transaction_id uuid references public.transactions(id) on delete set null,
  to_transaction_id   uuid references public.transactions(id) on delete set null,
  fee_transaction_id  uuid references public.transactions(id) on delete set null,
  note          text,
  created_by    text,
  created_at    timestamptz not null default now(),
  constraint transfers_contas_diferentes check (from_account_id <> to_account_id)
);
create index if not exists transfers_data_idx on public.transfers (date desc);

/* ══ 6. Campos em financial_accounts (§15.4) ════════════════════════════ */

alter table public.financial_accounts
  add column if not exists bank_code       text,
  add column if not exists branch          text,
  add column if not exists account_number  text,
  add column if not exists nickname        text,
  -- Gateway: em quantos dias cada forma de pagamento liquida, e como o
  -- repasse ao banco acontece.
  add column if not exists liquidity_days  jsonb not null default '{}'::jsonb,
  add column if not exists payout_rule     text,
  -- CSV não tem formato: o mapeamento de colunas fica salvo por conta para a
  -- segunda importação não repetir o trabalho da primeira.
  add column if not exists csv_mapping     jsonb,
  add column if not exists archived_at     timestamptz,
  -- Cartão de crédito: a fatura é o que transforma compras em uma saída só.
  add column if not exists statement_day   integer,
  add column if not exists due_day         integer,
  add column if not exists credit_limit_cents bigint,
  add column if not exists payment_account_id uuid references public.financial_accounts(id) on delete set null;

/* ══ 7. Conta prevista da parcela (§4.2 e §15.8) ════════════════════════ */

alter table public.installments
  -- É o que torna possível o fluxo POR CONTA: sem isso, toda parcela cairia
  -- na conta padrão e o fluxo de cada banco seria uma ficção.
  add column if not exists expected_account_id uuid
    references public.financial_accounts(id) on delete set null;

/* ══ 8. Regras de categorização (§15.7) ═════════════════════════════════ */

alter table public.categorization_rules
  add column if not exists account_id uuid references public.financial_accounts(id) on delete cascade,
  add column if not exists match_type text not null default 'text_contains'
    check (match_type in ('text_contains', 'document')),
  add column if not exists created_from_transaction_id uuid
    references public.transactions(id) on delete set null;

/* ══ 9. Método da conciliação: regra e lote (§15.6) ═════════════════════ */

alter table public.reconciliation_links drop constraint if exists reconciliation_links_method_check;
alter table public.reconciliation_links
  add constraint reconciliation_links_method_check
  check (method in ('auto', 'suggested', 'manual', 'rule', 'bulk'));

/* ══ 10. Snapshot mensal da projeção (§5.4 e §15.9) ═════════════════════ */

create table if not exists public.cash_forecast_snapshots (
  id            uuid primary key default gen_random_uuid(),
  month         date not null,
  cash_flow_line text not null,
  account_id    uuid references public.financial_accounts(id) on delete cascade,
  forecast_cents bigint not null default 0,
  taken_at      timestamptz not null default now(),
  unique (month, cash_flow_line, account_id)
);

/* ══ 11. RLS ════════════════════════════════════════════════════════════ */

do $$
declare t text;
begin
  foreach t in array array[
    'balance_checkpoints', 'statement_imports', 'transfers', 'cash_forecast_snapshots'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$I', t);
    execute format(
      'create policy "gerencial gerencia %1$s" on public.%1$I for all '
      'using (public.app_role() = ''gerencial'') with check (public.app_role() = ''gerencial'')',
      t);
  end loop;
end $$;
