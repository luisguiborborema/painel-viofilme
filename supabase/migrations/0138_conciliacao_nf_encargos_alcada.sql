-- 0138_conciliacao_nf_encargos_alcada.sql
--
-- Quatro frentes que faltavam para o Financeiro fechar com a contabilidade e
-- com o banco:
--
--  1. Conciliação bancária — extrato do banco (OFX/CSV) importado e casado com
--     os lançamentos. Sem isso o saldo do painel é estimativa, não fato.
--  2. Nota fiscal e impostos — nº da NF por cobrança e alíquota do regime, para
--     o DRE bater com o que o contador entrega.
--  3. Multa e juros por atraso — a régua cobra, mas o valor devido precisa subir.
--  4. Alçada de aprovação — despesa acima do limite passa pelo gestor antes de
--     virar "a pagar".
--
-- Tudo é aditivo: nenhuma coluna existente muda de tipo ou perde dado.

/* ───────────────────────── 1. Conciliação bancária ───────────────────────── */

-- Um arquivo de extrato importado.
create table if not exists public.bank_statements (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid references public.financial_accounts(id) on delete cascade,
  file_name    text,
  -- Período coberto pelo arquivo, lido do próprio extrato.
  from_date    date,
  to_date      date,
  entries_total integer not null default 0,
  imported_by  text,
  created_at   timestamptz not null default now()
);

-- Cada linha do extrato do banco. `amount` guarda o sinal: + entrou, - saiu.
create table if not exists public.bank_entries (
  id           uuid primary key default gen_random_uuid(),
  statement_id uuid references public.bank_statements(id) on delete cascade,
  account_id   uuid references public.financial_accounts(id) on delete cascade,
  -- FITID do OFX: identificador do banco. É o que impede lançar o mesmo
  -- extrato duas vezes.
  fitid        text,
  date         date not null,
  amount       numeric(12,2) not null,
  memo         text,
  -- Casamento com o lançamento do painel.
  matched_kind text,                  -- payment | expense | transfer
  matched_id   uuid,
  matched_at   timestamptz,
  -- Linha que não corresponde a lançamento nenhum e foi dispensada de propósito.
  ignored      boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists bank_entries_account_idx on public.bank_entries (account_id, date);
create index if not exists bank_entries_pendentes_idx on public.bank_entries (account_id) where matched_id is null and ignored = false;
-- Reimportar o mesmo arquivo não duplica: o FITID é único por conta.
create unique index if not exists bank_entries_fitid_idx on public.bank_entries (account_id, fitid) where fitid is not null;

alter table public.bank_statements enable row level security;
alter table public.bank_entries    enable row level security;
drop policy if exists "gerencial gerencia bank_statements" on public.bank_statements;
create policy "gerencial gerencia bank_statements" on public.bank_statements
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');
drop policy if exists "gerencial gerencia bank_entries" on public.bank_entries;
create policy "gerencial gerencia bank_entries" on public.bank_entries
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

/* ────────────────────────── 2. Nota fiscal / impostos ────────────────────── */

alter table public.payments
  add column if not exists invoice_number    text,
  add column if not exists invoice_url       text,
  add column if not exists invoice_issued_at date;

alter table public.expenses
  add column if not exists invoice_number    text;

/* ────────────────────── 3 e 4. Configuração do financeiro ────────────────── */

alter table public.finance_settings
  -- Impostos: alíquota efetiva sobre o faturamento (Simples, Presumido…).
  add column if not exists tax_regime  text          not null default 'simples',
  add column if not exists tax_rate    numeric(5,2)  not null default 0,
  -- Dia do mês em que a guia vence (DAS do Simples: dia 20).
  add column if not exists tax_due_day integer       not null default 20,

  -- Encargos por atraso. 0 desliga.
  add column if not exists late_fine            numeric(5,2) not null default 0,  -- multa % única
  add column if not exists late_interest_month  numeric(5,2) not null default 0,  -- juros % ao mês
  add column if not exists late_grace_days      integer      not null default 0,  -- carência

  -- Alçada: despesa acima deste valor precisa de aprovação. 0 desliga.
  add column if not exists approval_threshold numeric(12,2) not null default 0;

-- Fluxo de aprovação da despesa. 'approved' como padrão para que todo
-- lançamento que já existe continue pagável — a alçada só vale daqui pra frente.
alter table public.expenses
  add column if not exists approval_status   text not null default 'approved',  -- pending | approved | rejected
  add column if not exists approved_by       text,
  add column if not exists approved_at       timestamptz,
  add column if not exists approval_note     text;

create index if not exists expenses_approval_idx on public.expenses (approval_status) where approval_status = 'pending';

notify pgrst, 'reload schema';
