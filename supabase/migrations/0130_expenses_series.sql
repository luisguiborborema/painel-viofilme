-- 0130_expenses_series.sql
-- Contas a pagar: recorrência com parcelas REAIS.
--
-- Antes, `recurring` era só um indicador visual: o fluxo de caixa estimava o
-- valor todo mês, mas a conta de setembro não existia — não dava para marcar
-- como paga nem ver o que vence. Agora cada parcela é uma linha própria,
-- agrupada por `series_id`.

alter table public.expenses
  -- Agrupa as parcelas de uma mesma recorrência (null = lançamento avulso).
  add column if not exists series_id          uuid,
  -- Posição na série: 1/12, 2/12… (null quando a série é indefinida).
  add column if not exists installment        integer,
  add column if not exists installments_total integer,
  -- Periodicidade da série: monthly | weekly | yearly.
  add column if not exists recurrence         text,
  -- Série sem fim: a rotina diária mantém ~12 meses de parcelas à frente.
  add column if not exists open_ended         boolean not null default false;

create index if not exists expenses_series_idx on public.expenses (series_id, due_date);
create index if not exists expenses_due_idx    on public.expenses (due_date);
create index if not exists expenses_status_idx on public.expenses (status, due_date);

notify pgrst, 'reload schema';
