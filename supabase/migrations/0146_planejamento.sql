-- Planejamento financeiro (spec §14).
--
-- Convenções do documento-mãe §24, que valem aqui e não valem nas tabelas
-- antigas do financeiro: dinheiro em CENTAVOS inteiros (bigint, nunca float),
-- ids uuid, enums como constraint no banco. As tabelas existentes usam
-- numeric(12,2) em reais; a conversão acontece na leitura, não no cálculo.

-- Grupo gerencial da categoria, para o Orçado × realizado não depender de
-- nomes fixos (spec 5.2).
alter table public.expense_categories
  add column if not exists budget_line text;

create table if not exists public.budget_versions (
  id                 uuid primary key default gen_random_uuid(),
  year               int  not null,
  name               text not null,
  status             text not null default 'draft'
                     check (status in ('draft','approved','archived')),
  source_version_id  uuid references public.budget_versions(id) on delete set null,
  source_scenario_id uuid,
  approved_by        uuid references public.profiles(id) on delete set null,
  approved_at        timestamptz,
  created_by         uuid references public.profiles(id) on delete set null,
  created_at         timestamptz not null default now()
);
create index if not exists budget_versions_year_idx on public.budget_versions (year, status);

-- Um ano tem no máximo UMA versão aprovada vigente (spec 5.4). Índice parcial
-- em vez de regra na aplicação: assim duas aprovações simultâneas não passam.
create unique index if not exists budget_versions_uma_aprovada
  on public.budget_versions (year) where status = 'approved';

create table if not exists public.budget_assumptions (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references public.budget_versions(id) on delete cascade,
  type              text not null check (type in (
                      'new_clients','avg_ticket','churn','price_adjustment','one_off_revenue',
                      'seasonality','hire','salary_adjustment','fixed_cost','variable_cost_pct',
                      'commission_pct','tax_pct','investment','distribution')),
  params            jsonb not null default '{}',
  start_month       int,
  end_month         int,
  -- O valor que o sistema sugeriu e de onde ele veio. Premissa sem origem
  -- visível vira número mágico que ninguém sabe discutir (spec, princípio 2).
  suggested_value   numeric,
  suggestion_source text,
  description       text,
  updated_by        uuid references public.profiles(id) on delete set null,
  updated_at        timestamptz not null default now()
);
create index if not exists budget_assumptions_version_idx on public.budget_assumptions (version_id);

-- budgets já existe (0137) com month+category_key+amount em reais. Ganha o
-- vínculo com a versão e a marca de quem gerou o número.
alter table public.budgets
  add column if not exists version_id    uuid references public.budget_versions(id) on delete cascade,
  add column if not exists source        text not null default 'manual'
                                         check (source in ('assumption','manual')),
  add column if not exists assumption_id uuid references public.budget_assumptions(id) on delete set null;
create index if not exists budgets_version_idx on public.budgets (version_id);

create table if not exists public.budget_goals (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.budget_versions(id) on delete cascade,
  kpi         text not null check (kpi in ('mrr_end','revenue_year','op_margin','result_year','min_cash')),
  -- Centavos para os monetários; pontos percentuais para op_margin.
  target      bigint not null default 0,
  unique (version_id, kpi)
);

create table if not exists public.budget_reviews (
  id          uuid primary key default gen_random_uuid(),
  version_id  uuid not null references public.budget_versions(id) on delete cascade,
  month       date not null,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz not null default now(),
  status      text not null default 'done' check (status in ('open','done')),
  unique (version_id, month)
);

create table if not exists public.variance_comments (
  id                uuid primary key default gen_random_uuid(),
  version_id        uuid not null references public.budget_versions(id) on delete cascade,
  month             date not null,
  budget_line       text not null,
  text              text,
  -- Classificação obrigatória na revisão: "permanente" vira evento na projeção.
  classification    text not null check (classification in ('one_off','permanent')),
  forecast_event_id uuid,
  author            uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  unique (version_id, month, budget_line)
);

create table if not exists public.forecast_events (
  id           uuid primary key default gen_random_uuid(),
  type         text not null check (type in (
                 'new_client','client_leaving','fee_change','hire',
                 'one_off_cost','one_off_revenue','permanent_variance')),
  description  text not null,
  start_month  date not null,
  amount_cents bigint not null default 0,
  recurring    boolean not null default false,
  confidence   text not null default 'likely' check (confidence in ('confirmed','likely')),
  status       text not null default 'open' check (status in ('open','happened','expired','removed')),
  -- Para que o job diário case o evento com o registro real e não some em dobro.
  resolved_ref jsonb,
  resolved_at  timestamptz,
  origin       text not null default 'manual' check (origin in ('manual','review','quick_question')),
  budget_line  text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists forecast_events_month_idx on public.forecast_events (start_month, status);

create table if not exists public.scenarios (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  subtitle   text,
  color      text,
  base       text not null default 'forecast',
  levers     jsonb not null default '{}',
  is_default boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Parâmetros por função: capacidade e remuneração de referência (spec §14.10),
-- usados pelo aviso de capacidade e pelas perguntas rápidas.
create table if not exists public.role_params (
  id                     uuid primary key default gen_random_uuid(),
  key                    text not null unique,
  label                  text not null,
  capacity_per_person    int  not null default 10,
  reference_salary_cents bigint not null default 0,
  slots_per_client       numeric not null default 1,
  position               int not null default 0
);

insert into public.role_params (key, label, capacity_per_person, reference_salary_cents, position)
values
  ('social_media', 'Social Media', 11, 350000, 1),
  ('trafego',      'Tráfego',      16, 550000, 2),
  ('design',       'Design',       18, 420000, 3),
  ('audiovisual',  'Audiovisual',   7, 415000, 4),
  ('cs',           'CS',           24, 400000, 5)
on conflict (key) do nothing;

-- Reserva mínima: mesmo parâmetro do Caixa e do Dashboard (spec §11).
alter table public.finance_settings
  add column if not exists min_cash_reserve_cents bigint not null default 0,
  add column if not exists cash_conversion_factor numeric not null default 0.95;

-- RLS: planejamento é diretoria/financeiro (documento-mãe §21).
do $$
declare t text;
begin
  foreach t in array array[
    'budget_versions','budget_assumptions','budget_goals','budget_reviews',
    'variance_comments','forecast_events','scenarios','role_params'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %s" on public.%I', t, t);
    execute format(
      'create policy "gerencial gerencia %s" on public.%I for all using (public.app_role() = ''gerencial'') with check (public.app_role() = ''gerencial'')',
      t, t);
  end loop;
end $$;
