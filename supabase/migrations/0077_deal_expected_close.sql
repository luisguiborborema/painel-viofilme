-- 0077_deal_expected_close.sql
-- Data prevista de fechamento do negócio — alimenta a distribuição mensal do
-- Forecast do Pipeline (fallback: estimado por etapa quando vazio).

alter table public.crm_leads
  add column if not exists expected_close_at date;

notify pgrst, 'reload schema';
