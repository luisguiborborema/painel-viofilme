-- Resultados (spec §13) e o tipo de impacto do documento-mãe §10.
--
-- Hoje `expense_categories.dre_group` só distingue 'deducao' de 'custo'. Com
-- isso, investimento e distribuição de lucros caem em "custo" e derrubam a
-- margem do mês em que acontecem — uma câmera de R$ 18.900 vira prejuízo
-- operacional. O tipo de impacto é a lista fechada que resolve isso, e é ela
-- que decide sozinha onde cada categoria aparece na DRE.

alter table public.expense_categories
  add column if not exists impact_type text
    check (impact_type in (
      'operating_revenue','revenue_deduction','direct_cost',
      'operating_expense','financial_result','investment','equity_financing'));

-- Migração do que já existe, pelo grupo antigo. Fica conservador de propósito:
-- 'custo' vira despesa operacional, e quem souber que é investimento ou
-- distribuição ajusta em Configurações. Adivinhar aqui moveria dinheiro de
-- dentro para fora da DRE sem ninguém ver.
update public.expense_categories
   set impact_type = case dre_group
         when 'deducao' then 'revenue_deduction'
         else 'operating_expense'
       end
 where impact_type is null;

-- Projetos como dimensão de rentabilidade (§13.3).
create table if not exists public.projects (
  id             uuid primary key default gen_random_uuid(),
  client_id      uuid references public.clients(id) on delete set null,
  name           text not null,
  status         text not null default 'in_progress'
                 check (status in ('in_progress','done','cancelled')),
  contract_value_cents bigint not null default 0,
  budget_cost_cents    bigint not null default 0,
  start_date     date,
  end_date       date,
  created_at     timestamptz not null default now()
);
create index if not exists projects_client_idx on public.projects (client_id, status);

-- Alocação de equipe: a base do rateio (§15 do documento-mãe).
-- `capacity` é do COLABORADOR no mês, não da função: quem trabalha meio
-- período suporta menos clientes que o padrão da função, e sem isso a
-- ociosidade dele apareceria como folga do time.
create table if not exists public.team_allocations (
  id          uuid primary key default gen_random_uuid(),
  month       date not null,
  employee_id uuid references public.collaborators(id) on delete cascade,
  client_id   uuid references public.clients(id) on delete cascade,
  project_id  uuid references public.projects(id) on delete set null,
  service_id  text,
  weight      numeric not null default 1,
  capacity    int not null default 10,
  cost_cents  bigint not null default 0,
  frozen_at   timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists team_allocations_month_idx on public.team_allocations (month);
create unique index if not exists team_allocations_unica
  on public.team_allocations (month, employee_id, client_id)
  where client_id is not null;

-- Rentabilidade congelada no fechamento (§13.6). Mês aberto é calculado na
-- hora; mês fechado vira linha gravada, porque recalcular o passado quando a
-- carteira muda reescreveria um resultado que já foi comunicado.
create table if not exists public.client_profitability_monthly (
  id                uuid primary key default gen_random_uuid(),
  month             date not null,
  client_id         uuid references public.clients(id) on delete cascade,
  revenue_recurring_cents bigint not null default 0,
  revenue_one_off_cents   bigint not null default 0,
  deductions_cents  bigint not null default 0,
  team_cost         jsonb  not null default '{}',
  direct_costs_cents bigint not null default 0,
  margin_cents      bigint not null default 0,
  margin_pct        numeric,
  slots             numeric not null default 0,
  health            text check (health in ('saudavel','atencao','critica','sem-dados')),
  frozen_at         timestamptz,
  unique (month, client_id)
);

-- Movimentos de MRR (§13.5): novos, expansão, contração, churn, pausa.
create table if not exists public.mrr_movements (
  id             uuid primary key default gen_random_uuid(),
  month          date not null,
  client_id      uuid references public.clients(id) on delete cascade,
  type           text not null check (type in (
                   'new','reactivation','expansion','contraction','churn','pause','resume')),
  amount_cents   bigint not null default 0,
  reason         text,
  effective_date date not null,
  created_at     timestamptz not null default now()
);
create index if not exists mrr_movements_month_idx on public.mrr_movements (month, type);

-- Squad do cliente, para a visão por squad (§13.4).
alter table public.clients
  add column if not exists squad_id uuid references public.squads(id) on delete set null;

-- Limites de saúde e concentração (§14), configuráveis.
alter table public.finance_settings
  add column if not exists healthy_margin_pct     numeric not null default 55,
  add column if not exists attention_margin_pct   numeric not null default 40,
  add column if not exists concentration_limit_pct numeric not null default 15,
  add column if not exists churn_alert_pct        numeric not null default 2;

do $$
declare t text;
begin
  foreach t in array array[
    'projects','team_allocations','client_profitability_monthly','mrr_movements'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %s" on public.%I', t, t);
    execute format(
      'create policy "gerencial gerencia %s" on public.%I for all using (public.app_role() = ''gerencial'') with check (public.app_role() = ''gerencial'')',
      t, t);
  end loop;
end $$;
