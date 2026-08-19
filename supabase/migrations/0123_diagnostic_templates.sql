-- 0123_diagnostic_templates.sql
-- Roteiros de diagnóstico separados (Comercial vs Entregas) + campos calculados.
-- Cada modelo tem suas perguntas e suas fórmulas (computed).

create table if not exists public.diagnostic_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  area       text not null default 'comercial',   -- comercial | entregas | outro
  questions  jsonb not null default '[]'::jsonb,
  computed   jsonb not null default '[]'::jsonb,   -- [{id,label,formula,format}]
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.diagnostics
  add column if not exists template_id uuid references public.diagnostic_templates(id) on delete set null;

alter table public.diagnostic_templates enable row level security;
drop policy if exists "gerencial gerencia diag templates" on public.diagnostic_templates;
create policy "gerencial gerencia diag templates" on public.diagnostic_templates
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- Seed dos dois modelos padrão (só se ainda não houver nenhum).
insert into public.diagnostic_templates (name, area, position, questions, computed)
select 'Diagnóstico Comercial', 'comercial', 0,
  '[
    {"id":"faturamento","label":"Faturamento médio mensal","type":"currency","options":[],"hint":"Quanto a empresa fatura por mês hoje"},
    {"id":"ticket","label":"Ticket médio","type":"currency","options":[],"hint":"Valor médio por venda/cliente"},
    {"id":"leads_mes","label":"Leads recebidos por mês","type":"number","options":[],"hint":""},
    {"id":"conversao","label":"Taxa de conversão atual (%)","type":"number","options":[],"hint":"Dos leads, quantos viram venda"},
    {"id":"canais","label":"Principais canais de aquisição hoje","type":"textarea","options":[],"hint":""},
    {"id":"gargalo","label":"Maior gargalo hoje","type":"textarea","options":[],"hint":"O que mais trava o crescimento"},
    {"id":"invest_mkt","label":"Investimento atual em marketing (R$/mês)","type":"currency","options":[],"hint":""},
    {"id":"meta","label":"Meta de crescimento (%)","type":"number","options":[],"hint":""},
    {"id":"objetivo","label":"Objetivo principal com a Viofilme","type":"textarea","options":[],"hint":""}
  ]'::jsonb,
  '[
    {"id":"perda_estimada","label":"Perda estimada por mês (leads não convertidos)","formula":"leads_mes * (1 - conversao/100) * ticket","format":"currency"}
  ]'::jsonb
where not exists (select 1 from public.diagnostic_templates);

insert into public.diagnostic_templates (name, area, position, questions, computed)
select 'Diagnóstico de Entregas', 'entregas', 1,
  '[
    {"id":"clientes_ativos","label":"Nº de clientes ativos","type":"number","options":[],"hint":""},
    {"id":"entregas_mes","label":"Entregas por mês (posts/criativos)","type":"number","options":[],"hint":""},
    {"id":"capacidade","label":"Capacidade do time (entregas/mês)","type":"number","options":[],"hint":""},
    {"id":"prazo_aprovacao","label":"Prazo médio de aprovação (dias)","type":"number","options":[],"hint":""},
    {"id":"gargalos_prod","label":"Principais gargalos de produção","type":"textarea","options":[],"hint":""},
    {"id":"ferramentas","label":"Ferramentas usadas hoje","type":"textarea","options":[],"hint":""},
    {"id":"satisfacao","label":"Satisfação percebida do cliente (1–5)","type":"number","options":[],"hint":""}
  ]'::jsonb,
  '[
    {"id":"ocupacao","label":"Ocupação do time","formula":"entregas_mes / capacidade * 100","format":"percent"}
  ]'::jsonb
where (select count(*) from public.diagnostic_templates) = 1;

notify pgrst, 'reload schema';
