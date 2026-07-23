-- 0076_activity_goals.sql
-- Metas de ATIVIDADE por vendedor/mês (esforço), além da meta de MRR já
-- existente em crm_goals. Alimenta o "quanto falta de esforço" do Dashboard
-- Comercial (ex.: "faltam 18 ligações e 4 reuniões").

alter table public.crm_goals
  add column if not exists calls_target    int not null default 0,
  add column if not exists contatos_target int not null default 0,
  add column if not exists reunioes_target int not null default 0;

notify pgrst, 'reload schema';
