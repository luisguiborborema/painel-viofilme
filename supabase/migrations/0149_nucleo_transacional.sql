-- 0149_nucleo_transacional.sql
-- O núcleo transacional do documento-mãe (§5.2), que o módulo ainda não tinha.
--
-- POR QUE ESTA MIGRAÇÃO EXISTE
--
-- O documento-mãe fixa a fonte de cada página (§4) e transforma isso em
-- invariante testável (§23.1): "Recebimentos e Pagamentos leem installments;
-- Resultados lê document_items por competência; Caixa lê transactions."
--
-- O que havia aqui era outro modelo: `expenses` (uma linha = uma despesa, sem
-- itens, sem parcelas, sem baixas) e `payments` (formato do Asaas). Nele não
-- cabe rateio entre categorias e clientes, nem baixa parcial, nem juros, multa
-- e desconto — que são requisitos, não enfeites. Construir Pagamentos sobre
-- `expenses` seria construí-lo duas vezes.
--
-- A CADEIA (§6)
--
--   parties ──▶ documents ──▶ document_items   (onde moram as dimensões)
--                    └─────▶ installments ──▶ settlements ──▶ transactions
--                                  └────────▶ charges
--
-- CONVENÇÕES (§24)
--   • dinheiro em CENTAVOS, bigint. Nunca float, nunca numeric de reais;
--   • datas `date`; competência sempre no dia 1 do mês;
--   • status e direção com constraint, não texto livre;
--   • o saldo da conta nunca é digitado: é saldo inicial + movimentações.
--
-- As tabelas antigas NÃO são apagadas. Os dados são copiados para o núcleo e
-- `expenses`/`payments` seguem existindo até as telas antigas saírem do ar —
-- "nada some" é invariante (§23.7).

/* ══ 1. Cadastros ═══════════════════════════════════════════════════════ */

-- Centro de custo: lista curta e fixa (§5.1).
create table if not exists public.cost_centers (
  id       uuid primary key default gen_random_uuid(),
  key      text not null unique,
  name     text not null,
  position integer not null default 0
);

insert into public.cost_centers (key, name, position) values
  ('entrega',        'Entrega',        1),
  ('comercial',      'Comercial',      2),
  ('administrativo', 'Administrativo', 3),
  ('diretoria',      'Diretoria',      4)
on conflict (key) do nothing;

/**
 * Pessoa (§5.1) — cadastro de quem paga e de quem recebe.
 *
 * O documento-mãe quer um cadastro único do ERP, compartilhado com CRM, Hub e
 * RH. Unificar `clients` inteiro é trabalho de outro módulo, então aqui a
 * ponte é `client_id`: o cliente continua morando em `clients` e ganha uma
 * `party` espelho, para que `documents.party_id` sempre aponte para um só
 * lugar. A unificação completa fica anotada como próximo passo.
 */
create table if not exists public.parties (
  id          uuid primary key default gen_random_uuid(),
  type        text not null default 'pj' check (type in ('pf', 'pj')),
  name        text not null,
  legal_name  text,
  -- CPF/CNPJ só com dígitos. Deduplica e casa PIX na conciliação (§5.1).
  document    text,
  email       text,
  phone       text,
  -- client, supplier, freelancer, government, employee, partner
  roles       text[] not null default '{}',
  status      text not null default 'active' check (status in ('active', 'inactive')),

  -- Dados de pagamento padrão (spec Pagamentos §2.2 e §20.2). Toda conta nova
  -- do fornecedor herda daqui; é o que faz o ciclo copiar → pagar → baixar
  -- levar segundos em vez de minutos.
  payment_method text,
  pix_key_type   text,
  pix_key        text,
  bank_account   jsonb,
  payee_name     text,
  -- Trocar conta de destino é vetor clássico de fraude: a data alimenta o
  -- aviso de 30 dias nas próximas contas do fornecedor (spec §13.3).
  payment_data_changed_at timestamptz,
  payment_data_changed_by text,

  -- Padrões ao lançar uma despesa deste fornecedor (spec §10.3).
  default_category_key   text,
  default_cost_center_id uuid references public.cost_centers(id) on delete set null,
  default_account_id     uuid references public.financial_accounts(id) on delete set null,

  client_id  uuid references public.clients(id) on delete set null,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists parties_document_idx
  on public.parties (document) where document is not null and document <> '';
create index if not exists parties_roles_idx on public.parties using gin (roles);
create index if not exists parties_name_idx on public.parties (lower(name));

/* ══ 2. Categorias: o que faltava para o plano de contas (§5.1, §10) ════ */

alter table public.expense_categories
  add column if not exists parent_id        uuid references public.expense_categories(id) on delete set null,
  add column if not exists direction        text not null default 'out' check (direction in ('in', 'out')),
  add column if not exists default_cost_center_id uuid references public.cost_centers(id) on delete set null,
  -- Exigir cliente/projeto no item: é o que impede custo direto órfão, que
  -- some da rentabilidade sem ninguém perceber (§12).
  add column if not exists requires_client  boolean not null default false,
  add column if not exists requires_employee boolean not null default false,
  -- Documentos esperados (spec Pagamentos §2.3).
  add column if not exists requires_invoice boolean not null default false,
  add column if not exists requires_receipt boolean not null default false;

-- Custo direto passa a exigir cliente por padrão: é a regra do §12.
update public.expense_categories
   set requires_client = true
 where impact_type = 'direct_cost' and requires_client = false;

/* ══ 3. Contas: cartão de crédito (spec Pagamentos §6.1) ════════════════ */

-- O cartão é uma conta financeira de saldo negativo (a dívida). Cada compra é
-- despesa liquidada nele; a fatura é TRANSFERÊNCIA, não despesa — senão cada
-- compra seria contada duas vezes.
alter table public.financial_accounts
  add column if not exists closing_day        integer,
  add column if not exists due_day            integer,
  add column if not exists last_digits        text,
  add column if not exists credit_limit       numeric(12,2),
  add column if not exists payment_account_id uuid references public.financial_accounts(id) on delete set null;

/* ══ 4. Recorrências (§5.2, §9) ═════════════════════════════════════════ */

create table if not exists public.recurrences (
  id            uuid primary key default gen_random_uuid(),
  direction     text not null check (direction in ('in', 'out')),
  -- `team` é a recorrência de equipe: gera a folha e NÃO aparece na aba
  -- Recorrências (spec Pagamentos §11.10).
  kind          text not null default 'standard' check (kind in ('standard', 'team')),
  party_id      uuid references public.parties(id) on delete set null,
  description   text not null,
  frequency     text not null default 'monthly' check (frequency in ('monthly', 'weekly', 'yearly')),
  due_day       integer not null default 5,
  start_date    date not null,
  end_date      date,
  amount_cents  bigint not null default 0,
  -- Como estimar quando o valor só se conhece perto do vencimento (§2.1):
  -- fixed | last | avg3 | revenue_pct.
  estimation_method text not null default 'fixed'
    check (estimation_method in ('fixed', 'last', 'avg3', 'revenue_pct')),
  estimation_params jsonb not null default '{}'::jsonb,
  payment_method   text,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  category_key  text,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  client_id     uuid references public.clients(id) on delete set null,
  competence_offset integer not null default 0,  -- 0 = mês do vencimento, -1 = anterior
  status        text not null default 'active' check (status in ('draft', 'active', 'paused', 'ended')),
  generation_horizon_months integer not null default 3,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists recurrences_dir_idx on public.recurrences (direction, status);

-- Histórico de valor com vigência e motivo (§9): reajuste não reescreve o
-- passado, cria versão.
create table if not exists public.recurrence_versions (
  id            uuid primary key default gen_random_uuid(),
  recurrence_id uuid not null references public.recurrences(id) on delete cascade,
  amount_cents  bigint not null,
  valid_from    date not null,
  reason        text,
  created_by    text,
  created_at    timestamptz not null default now()
);
create index if not exists recurrence_versions_idx
  on public.recurrence_versions (recurrence_id, valid_from desc);

/* ══ 5. Núcleo transacional (§5.2) ══════════════════════════════════════ */

-- Título: o compromisso. A receber e a pagar são o MESMO objeto, com direção
-- diferente — é isso que faz as duas páginas compartilharem ficha e baixa.
create table if not exists public.documents (
  id            uuid primary key default gen_random_uuid(),
  direction     text not null check (direction in ('in', 'out')),
  party_id      uuid references public.parties(id) on delete set null,
  description   text not null,
  issue_date    date not null default current_date,
  total_cents   bigint not null default 0,
  recurrence_id uuid references public.recurrences(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,
  client_id     uuid references public.clients(id) on delete set null,
  -- De onde veio (§19): manual | recurrence | import | integration | operation
  origin        text not null default 'manual',
  origin_ref    text,
  -- Reembolso a colaborador (spec Pagamentos §15).
  reimbursement_employee_id uuid references public.parties(id) on delete set null,
  -- Leitura de documento por IA (spec §10.1): quais campos vieram do arquivo.
  extracted_fields text[],
  invoice_number text,
  notes         text,
  created_by    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists documents_dir_idx on public.documents (direction, issue_date desc);
create unique index if not exists documents_origin_ref_idx
  on public.documents (origin_ref) where origin_ref is not null;

-- Item: é AQUI que moram as dimensões de análise. Rateio entre categorias ou
-- clientes é só ter vários itens — não existe funcionalidade separada (§5.2).
create table if not exists public.document_items (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  amount_cents  bigint not null,
  category_key  text,
  cost_center_id uuid references public.cost_centers(id) on delete set null,
  service_id    uuid references public.services(id) on delete set null,
  client_id     uuid references public.clients(id) on delete set null,
  project_id    uuid references public.projects(id) on delete set null,
  employee_id   uuid references public.parties(id) on delete set null,
  description   text,
  position      integer not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists document_items_doc_idx on public.document_items (document_id);
create index if not exists document_items_cat_idx on public.document_items (category_key);

-- Parcela: a unidade que vence, e a unidade operacional das duas páginas.
create table if not exists public.installments (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references public.documents(id) on delete cascade,
  number        integer not null default 1,
  total_number  integer not null default 1,
  due_date      date not null,
  -- Sempre o dia 1 do mês (§24). Independente do vencimento (§8).
  competence_month date not null,
  amount_cents  bigint not null,
  -- Saldo = valor − Σ principal das baixas não estornadas. Nunca negativo
  -- (§23.4). A constraint é a trava; o cálculo é do gatilho abaixo.
  open_balance_cents bigint not null,
  status        text not null default 'open'
                check (status in ('open', 'partial', 'settled', 'cancelled', 'renegotiated')),
  -- Eixo paralelo, não se mistura ao status (§7.3).
  approval_status text not null default 'not_required'
                check (approval_status in ('not_required', 'pending', 'approved', 'rejected')),
  -- "Programado" NÃO é status: é parcela aberta com data preenchida (§7.4).
  scheduled_payment_date date,
  -- Valor estimado (spec Pagamentos §2.1). Entra na projeção e na DRE pelo
  -- estimado; confirmar preserva o original no histórico.
  amount_status text not null default 'confirmed'
                check (amount_status in ('estimated', 'confirmed')),
  estimated_amount_cents bigint,
  -- Como pagar (spec §2.2): método, linha digitável, PIX, favorecido.
  payment_details jsonb,
  cancelled_reason text,
  renegotiated_to  uuid references public.documents(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint installments_saldo_valido
    check (open_balance_cents >= 0 and open_balance_cents <= amount_cents)
);
create index if not exists installments_due_idx on public.installments (due_date);
create index if not exists installments_doc_idx on public.installments (document_id);
create index if not exists installments_comp_idx on public.installments (competence_month);

-- Cobrança: o INSTRUMENTO enviado ao cliente. A parcela é a verdade
-- financeira; a cobrança é só o meio, e pode ser reemitida (§5.2).
create table if not exists public.charges (
  id             uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.installments(id) on delete cascade,
  method         text,
  provider       text not null default 'manual',
  external_id    text,
  url            text,
  status         text,
  sent_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists charges_inst_idx on public.charges (installment_id);

-- Baixa: só o PRINCIPAL abate o saldo. Juros e multa viram resultado
-- financeiro; desconto, dedução ou despesa financeira (§5.2).
create table if not exists public.settlements (
  id             uuid primary key default gen_random_uuid(),
  installment_id uuid not null references public.installments(id) on delete cascade,
  date           date not null,
  principal_cents bigint not null,
  interest_cents  bigint not null default 0,
  fine_cents      bigint not null default 0,
  discount_cents  bigint not null default 0,
  financial_account_id uuid references public.financial_accounts(id) on delete set null,
  method         text,
  origin         text not null default 'manual',
  -- Pagar sem a NF exigida pede justificativa, e ela fica registrada (spec §8).
  missing_invoice_justification text,
  -- Estorno não apaga: marca. "Nada some" (§23.7).
  reversed_at    timestamptz,
  reversed_reason text,
  created_by     text,
  created_at     timestamptz not null default now()
);
create index if not exists settlements_inst_idx on public.settlements (installment_id);
create index if not exists settlements_date_idx on public.settlements (date);

-- Movimentação: dinheiro que EFETIVAMENTE passou numa conta (§13).
create table if not exists public.transactions (
  id            uuid primary key default gen_random_uuid(),
  financial_account_id uuid not null references public.financial_accounts(id) on delete cascade,
  date          date not null,
  -- Positivo entra, negativo sai.
  amount_cents  bigint not null,
  description_raw text,
  counterparty_document text,
  origin        text not null default 'manual' check (origin in ('manual', 'import', 'integration')),
  external_id   text,
  -- hash(conta + data + valor + descrição): reimportar o mesmo arquivo nunca
  -- duplica (§13.2).
  fingerprint   text,
  confirmation_status text not null default 'confirmed'
                check (confirmation_status in ('pending_confirmation', 'confirmed')),
  reconciliation_status text not null default 'unreconciled'
                check (reconciliation_status in ('unreconciled', 'reconciled', 'ignored')),
  ignored_reason text,
  created_at    timestamptz not null default now()
);
create unique index if not exists transactions_fingerprint_idx
  on public.transactions (financial_account_id, fingerprint) where fingerprint is not null;
create index if not exists transactions_account_date_idx
  on public.transactions (financial_account_id, date desc);

-- Conciliação N:N: um PIX pode quitar duas parcelas, e uma parcela pode ser
-- paga em dois PIX (§5.2).
create table if not exists public.reconciliation_links (
  id             uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  settlement_id  uuid not null references public.settlements(id) on delete cascade,
  amount_cents   bigint not null,
  method         text not null default 'manual' check (method in ('auto', 'suggested', 'manual')),
  created_by     text,
  created_at     timestamptz not null default now(),
  unique (transaction_id, settlement_id)
);

-- Anexos: três espaços esperados por conta (spec Pagamentos §2.3).
create table if not exists public.attachments (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid references public.documents(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete cascade,
  kind        text not null default 'other'
              check (kind in ('boleto', 'invoice_nf', 'receipt', 'contract', 'other')),
  url         text not null,
  file_name   text,
  uploaded_by text,
  created_at  timestamptz not null default now()
);
create index if not exists attachments_doc_idx on public.attachments (document_id, kind);

-- Regra aprendida na conciliação: "descrição contém ADOBE → Adobe, Software".
create table if not exists public.categorization_rules (
  id           uuid primary key default gen_random_uuid(),
  match_text   text not null,
  party_id     uuid references public.parties(id) on delete set null,
  category_key text,
  hits         integer not null default 1,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);
create unique index if not exists categorization_rules_text_idx
  on public.categorization_rules (lower(match_text));

/* ══ 6. O saldo da parcela é derivado, não digitado (§23.4) ═════════════ */

/**
 * Recalcula saldo e status da parcela a partir das baixas.
 *
 * Fica no banco, e não no aplicativo, porque a invariante precisa valer para
 * QUEM escrever — rota, job, importação ou SQL no editor. Saldo derivado em
 * código é saldo que uma segunda porta de escrita desfaz em silêncio.
 */
create or replace function public.recalcular_parcela(p_installment uuid)
returns void language plpgsql as $$
declare
  v_amount bigint;
  v_pago   bigint;
  v_status text;
begin
  select amount_cents into v_amount from public.installments where id = p_installment;
  if v_amount is null then return; end if;

  select coalesce(sum(principal_cents), 0) into v_pago
    from public.settlements
   where installment_id = p_installment and reversed_at is null;

  -- Nunca negativo: pagar a mais vira encargo, não saldo negativo.
  v_pago := least(v_pago, v_amount);

  select case
    when status in ('cancelled', 'renegotiated') then status
    when v_amount - v_pago <= 0 then 'settled'
    when v_pago > 0 then 'partial'
    else 'open'
  end into v_status from public.installments where id = p_installment;

  update public.installments
     set open_balance_cents = v_amount - v_pago,
         status = v_status,
         updated_at = now()
   where id = p_installment;
end $$;

create or replace function public.trg_recalcular_parcela()
returns trigger language plpgsql as $$
begin
  -- TG_OP em vez de coalesce(new.…, old.…): num DELETE o registro NEW não
  -- existe em PL/pgSQL, e ler um campo dele aborta o comando com
  -- "record new is not assigned yet" — ou seja, estornar baixa quebraria.
  if tg_op = 'DELETE' then
    perform public.recalcular_parcela(old.installment_id);
  else
    perform public.recalcular_parcela(new.installment_id);
    -- Baixa movida de parcela: a antiga também precisa ser recalculada.
    if tg_op = 'UPDATE' and old.installment_id is distinct from new.installment_id then
      perform public.recalcular_parcela(old.installment_id);
    end if;
  end if;
  return null;
end $$;

drop trigger if exists settlements_recalcula on public.settlements;
create trigger settlements_recalcula
  after insert or update or delete on public.settlements
  for each row execute function public.trg_recalcular_parcela();

/* ══ 7. RLS ═════════════════════════════════════════════════════════════ */

do $$
declare t text;
begin
  foreach t in array array[
    'cost_centers', 'parties', 'recurrences', 'recurrence_versions',
    'documents', 'document_items', 'installments', 'charges', 'settlements',
    'transactions', 'reconciliation_links', 'attachments', 'categorization_rules'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$I', t);
    execute format(
      'create policy "gerencial gerencia %1$s" on public.%1$I for all '
      'using (public.app_role() = ''gerencial'') with check (public.app_role() = ''gerencial'')',
      t);
  end loop;
end $$;

/* ══ 8. Migração dos dados existentes ═══════════════════════════════════ */

-- Idempotente por `origin_ref`: rodar duas vezes não duplica nada.

-- 8.1 Clientes viram parties espelho (papel client), mantendo o vínculo.
insert into public.parties (name, roles, client_id, type, status)
select c.name, array['client'], c.id, 'pj',
       case when c.status = 'churn' then 'inactive' else 'active' end
  from public.clients c
 where not exists (select 1 from public.parties p where p.client_id = c.id);

-- 8.2 Fornecedores nascem do texto livre que havia em `expenses.vendor`.
insert into public.parties (name, roles, type)
select distinct on (lower(trim(e.vendor))) trim(e.vendor), array['supplier'], 'pj'
  from public.expenses e
 where coalesce(trim(e.vendor), '') <> ''
   and not exists (
     select 1 from public.parties p
      where lower(p.name) = lower(trim(e.vendor)) and 'supplier' = any (p.roles))
 order by lower(trim(e.vendor));

-- 8.3 Despesas viram título + item + parcela (+ baixa, se pagas).
with nova as (
  insert into public.documents
    (direction, party_id, description, issue_date, total_cents, client_id,
     origin, origin_ref, invoice_number, created_at)
  select 'out',
         (select p.id from public.parties p
           where lower(p.name) = lower(trim(e.vendor)) and 'supplier' = any (p.roles) limit 1),
         coalesce(nullif(trim(e.description), ''), 'Despesa'),
         coalesce(e.due_date, current_date),
         round(coalesce(e.amount, 0) * 100)::bigint,
         e.client_id,
         case when e.series_id is not null then 'recurrence' else 'manual' end,
         'expense:' || e.id::text,
         e.invoice_number,
         e.created_at
    from public.expenses e
   where not exists (
     select 1 from public.documents d where d.origin_ref = 'expense:' || e.id::text)
  returning id, origin_ref, total_cents, issue_date
)
insert into public.document_items (document_id, amount_cents, category_key, client_id, description)
select n.id, n.total_cents, e.category, e.client_id, nullif(trim(e.description), '')
  from nova n
  join public.expenses e on 'expense:' || e.id::text = n.origin_ref;

insert into public.installments
  (document_id, number, total_number, due_date, competence_month, amount_cents,
   open_balance_cents, status, approval_status, amount_status)
select d.id,
       coalesce(e.installment, 1),
       coalesce(e.installments_total, 1),
       coalesce(e.due_date, current_date),
       date_trunc('month', coalesce(e.due_date, current_date))::date,
       round(coalesce(e.amount, 0) * 100)::bigint,
       case when e.status = 'paid' then 0 else round(coalesce(e.amount, 0) * 100)::bigint end,
       case when e.status = 'paid' then 'settled' else 'open' end,
       case when coalesce(e.approval_status, 'approved') = 'pending' then 'pending' else 'not_required' end,
       'confirmed'
  from public.expenses e
  join public.documents d on d.origin_ref = 'expense:' || e.id::text
 where not exists (select 1 from public.installments i where i.document_id = d.id);

insert into public.settlements
  (installment_id, date, principal_cents, financial_account_id, origin, created_at)
select i.id, coalesce(e.paid_date, e.due_date, current_date),
       round(coalesce(e.amount, 0) * 100)::bigint, e.account_id, 'manual', e.updated_at
  from public.expenses e
  join public.documents d on d.origin_ref = 'expense:' || e.id::text
  join public.installments i on i.document_id = d.id
 where e.status = 'paid'
   and not exists (select 1 from public.settlements s where s.installment_id = i.id);

-- 8.4 Recebimentos viram título + item + parcela (+ baixa e cobrança).
with nova as (
  insert into public.documents
    (direction, party_id, description, issue_date, total_cents, client_id,
     origin, origin_ref, created_at)
  select 'in',
         (select p.id from public.parties p where p.client_id = pay.client_id limit 1),
         coalesce(nullif(trim(pay.description), ''), 'Recebimento'),
         coalesce(pay.due_date, current_date),
         round(coalesce(pay.value, 0) * 100)::bigint,
         pay.client_id,
         case when coalesce(pay.source, 'asaas') = 'asaas' then 'integration' else 'manual' end,
         'payment:' || pay.id::text,
         pay.created_at
    from public.payments pay
   where not exists (
     select 1 from public.documents d where d.origin_ref = 'payment:' || pay.id::text)
  returning id, origin_ref, total_cents
)
insert into public.document_items (document_id, amount_cents, category_key, client_id, description)
select n.id, n.total_cents, null, pay.client_id, nullif(trim(pay.description), '')
  from nova n
  join public.payments pay on 'payment:' || pay.id::text = n.origin_ref;

insert into public.installments
  (document_id, due_date, competence_month, amount_cents, open_balance_cents, status)
select d.id,
       coalesce(pay.due_date, current_date),
       date_trunc('month', coalesce(pay.due_date, current_date))::date,
       round(coalesce(pay.value, 0) * 100)::bigint,
       case when pay.status in ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH','DUNNING_RECEIVED')
            then 0 else round(coalesce(pay.value, 0) * 100)::bigint end,
       case when pay.status in ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH','DUNNING_RECEIVED')
            then 'settled'
            when pay.status in ('REFUNDED','REFUND_REQUESTED','CHARGEBACK_REQUESTED','DELETED')
            then 'cancelled'
            else 'open' end
  from public.payments pay
  join public.documents d on d.origin_ref = 'payment:' || pay.id::text
 where not exists (select 1 from public.installments i where i.document_id = d.id);

insert into public.settlements
  (installment_id, date, principal_cents, financial_account_id, method, origin)
select i.id, coalesce(pay.payment_date, pay.due_date, current_date),
       round(coalesce(pay.value, 0) * 100)::bigint, pay.account_id, pay.billing_type,
       case when coalesce(pay.source, 'asaas') = 'asaas' then 'integration' else 'manual' end
  from public.payments pay
  join public.documents d on d.origin_ref = 'payment:' || pay.id::text
  join public.installments i on i.document_id = d.id
 where pay.status in ('RECEIVED','CONFIRMED','RECEIVED_IN_CASH','DUNNING_RECEIVED')
   and not exists (select 1 from public.settlements s where s.installment_id = i.id);

insert into public.charges (installment_id, method, provider, external_id, url, status)
select i.id, pay.billing_type,
       case when coalesce(pay.source, 'asaas') = 'asaas' then 'asaas' else 'manual' end,
       pay.asaas_payment_id, pay.invoice_url, pay.status
  from public.payments pay
  join public.documents d on d.origin_ref = 'payment:' || pay.id::text
  join public.installments i on i.document_id = d.id
 where coalesce(pay.invoice_url, '') <> ''
   and not exists (select 1 from public.charges c where c.installment_id = i.id);
