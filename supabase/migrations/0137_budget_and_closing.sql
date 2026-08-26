-- 0137_budget_and_closing.sql
-- Orçamento por categoria e fechamento de período.
--
--  • Orçamento: quanto a empresa PLANEJA gastar em cada categoria por mês.
--    Sem isso o DRE só conta o passado; com isso dá para ver o desvio a tempo.
--  • Fechamento: depois de fechar o mês, lançamento retroativo não muda mais.
--    É o que dá confiabilidade ao histórico — um relatório fechado em março não
--    pode mudar em maio porque alguém editou uma despesa antiga.

create table if not exists public.budgets (
  id           uuid primary key default gen_random_uuid(),
  -- Mês de referência, sempre no dia 1 (ex.: 2026-09-01).
  month        date not null,
  category_key text not null,
  amount       numeric(12,2) not null default 0,
  note         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists budgets_month_cat_idx on public.budgets (month, category_key);
create index if not exists budgets_month_idx on public.budgets (month);

alter table public.budgets enable row level security;
drop policy if exists "gerencial gerencia budgets" on public.budgets;
create policy "gerencial gerencia budgets" on public.budgets
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- Fechamento: tudo com vencimento ATÉ esta data está travado para edição.
alter table public.finance_settings
  add column if not exists closed_until date,
  add column if not exists closed_by    text,
  add column if not exists closed_at    timestamptz,
  -- Regime padrão do DRE: competencia (vencimento) | caixa (pagamento).
  add column if not exists dre_regime   text not null default 'competencia';

notify pgrst, 'reload schema';
