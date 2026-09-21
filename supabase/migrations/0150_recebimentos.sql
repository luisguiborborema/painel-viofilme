-- 0150_recebimentos.sql
-- O que a página de Recebimentos precisa e o núcleo (0149) ainda não tinha.
--
-- Três blocos, e cada um existe por um motivo diferente:
--
--  1) A RÉGUA DE COBRANÇA como dado, não como código. Etapas configuráveis
--     (D−5, D+0, D+3, D+10, D+20, D+30) com ação, canal e modo. O estado da
--     régua por parcela NÃO é gravado: é derivado dos eventos + dias de
--     atraso + promessas ativas (§14.5 da spec). Estado de cobrança gravado
--     envelhece sozinho e passa a mentir no dia seguinte.
--
--  2) A LINHA DO TEMPO da cobrança (`collection_events`) e as PROMESSAS de
--     pagamento. É o que responde "o que já fizemos sobre esse atraso?" — a
--     pergunta que hoje só existe na memória de quem cobrou.
--
--  3) O CADASTRO FINANCEIRO do cliente em `parties`: e-mails de cobrança,
--     dia de vencimento, juros e multa próprios, endereço. É isso que faz o
--     Financeiro funcionar sem depender do CRM (§10 da spec).

/* ══ 1. Régua de cobrança (§14.5) ═══════════════════════════════════════ */

create table if not exists public.dunning_profiles (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  is_default boolean not null default false,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.dunning_steps (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.dunning_profiles(id) on delete cascade,
  -- Negativo = antes do vencimento. D−5 é o envio da cobrança.
  offset_days integer not null,
  action      text not null,
  -- `manual` existe porque o WhatsApp ainda não tem template aprovado: a
  -- etapa fica pronta e vira pendência para alguém enviar (§9.2).
  mode        text not null default 'automatic'
              check (mode in ('automatic', 'manual', 'task')),
  channel     text,
  position    integer not null default 0
);
create index if not exists dunning_steps_profile_idx on public.dunning_steps (profile_id, offset_days);

-- A régua padrão da spec §9.2. Só é semeada uma vez.
insert into public.dunning_profiles (name, is_default)
select 'Padrão', true
 where not exists (select 1 from public.dunning_profiles where is_default);

insert into public.dunning_steps (profile_id, offset_days, action, mode, channel, position)
select p.id, v.dias, v.acao, v.modo, v.canal, v.pos
  from public.dunning_profiles p
  cross join (values
    (-5,  'Envio da cobrança',      'automatic', 'email',        1),
    ( 0,  'Lembrete no vencimento', 'automatic', 'email',        2),
    ( 3,  'Aviso de atraso',        'automatic', 'email',        3),
    (10,  'WhatsApp',               'manual',    'whatsapp',     4),
    (20,  'CS acionado',            'automatic', 'notification', 5),
    (30,  'Diretoria',              'task',      null,           6)
  ) as v(dias, acao, modo, canal, pos)
 where p.is_default
   and not exists (select 1 from public.dunning_steps s where s.profile_id = p.id);

/* ══ 2. Linha do tempo e promessas (§14.3, §14.4) ═══════════════════════ */

create table if not exists public.collection_events (
  id             uuid primary key default gen_random_uuid(),
  party_id       uuid references public.parties(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete set null,
  type           text not null check (type in (
                   'charge_sent', 'reminder', 'overdue_notice', 'whatsapp',
                   'cs_triggered', 'escalation', 'contact', 'promise',
                   'promise_broken', 'renegotiation', 'pause', 'resume', 'write_off')),
  channel        text,
  -- Ação automática entra com `automatic = true` e autor "sistema" (§16).
  automatic      boolean not null default false,
  -- Só para contatos: não atendeu, vai pagar, pediu prazo, contestou.
  result         text,
  note           text,
  created_by     text,
  created_at     timestamptz not null default now()
);
create index if not exists collection_events_party_idx
  on public.collection_events (party_id, created_at desc);

create table if not exists public.payment_promises (
  id             uuid primary key default gen_random_uuid(),
  party_id       uuid not null references public.parties(id) on delete cascade,
  installment_ids uuid[] not null default '{}',
  promised_date  date not null,
  amount_cents   bigint not null default 0,
  -- A promessa pausa a régua até a data. Quebrada, a régua retoma na etapa
  -- correspondente aos dias de atraso — e a quebra conta como sinal de risco.
  status         text not null default 'active'
                 check (status in ('active', 'fulfilled', 'broken', 'cancelled')),
  created_by     text,
  created_at     timestamptz not null default now(),
  resolved_at    timestamptz
);
create index if not exists payment_promises_party_idx
  on public.payment_promises (party_id, status);

/* ══ 3. Cadastro financeiro do cliente (§14.6) ══════════════════════════ */

alter table public.parties
  -- Separados dos contatos comerciais de propósito: quem aprova a proposta
  -- raramente é quem paga o boleto (§10.2).
  add column if not exists billing_emails        text[] not null default '{}',
  add column if not exists billing_whatsapp      text,
  add column if not exists billing_contact_name  text,
  add column if not exists default_billing_method text,
  add column if not exists default_due_day       integer,
  add column if not exists default_send_days_before integer,
  add column if not exists dunning_profile_id    uuid references public.dunning_profiles(id) on delete set null,
  -- Nulos = usa o padrão de Configurações. Não duplicar o padrão em cada
  -- cliente é o que permite mudá-lo num lugar só.
  add column if not exists custom_fine_pct       numeric(5,2),
  add column if not exists custom_interest_pct   numeric(5,2),
  add column if not exists municipal_registration text,
  add column if not exists address               jsonb;

/* ══ 4. Campos em documents, installments e settlements (§14.7, §14.8) ══ */

alter table public.documents
  add column if not exists nf_number text,
  add column if not exists nf_date   date;

alter table public.installments
  -- Guardado na PRIMEIRA alteração de vencimento: é o que permite decidir se
  -- os encargos contam do vencimento original ou do novo (§11).
  add column if not exists original_due_date date;

alter table public.settlements
  add column if not exists fee_waived        boolean not null default false,
  add column if not exists fee_waiver_reason text,
  add column if not exists waived_amount_cents bigint not null default 0;

/* ══ 5. Campos que faltavam em recurrences (§14.2) ══════════════════════ */

alter table public.recurrences
  add column if not exists paused_until        date,
  add column if not exists pause_reason        text,
  add column if not exists end_reason          text,
  add column if not exists adjustment_rule     text,
  add column if not exists adjustment_base_date date;

/* ══ 6. RLS ═════════════════════════════════════════════════════════════ */

do $$
declare t text;
begin
  foreach t in array array[
    'dunning_profiles', 'dunning_steps', 'collection_events', 'payment_promises'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$I', t);
    execute format(
      'create policy "gerencial gerencia %1$s" on public.%1$I for all '
      'using (public.app_role() = ''gerencial'') with check (public.app_role() = ''gerencial'')',
      t);
  end loop;
end $$;
