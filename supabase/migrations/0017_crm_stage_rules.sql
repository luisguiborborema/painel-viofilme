-- ============================================================================
-- PAINEL VIOFILME — CRM: regras de movimentação por estágio
--
-- Cada estágio pode exigir requisitos para um negócio ENTRAR nele (como as
-- "propriedades obrigatórias" do HubSpot). Guardados em `requirements` (jsonb):
--   [{ source: "property"|"native", field, label, op: "filled"|"true"|"equals"|"gt", value? }]
-- A validação roda no cliente (feedback ao arrastar) e no servidor (garantia).
-- ============================================================================
alter table public.crm_stages
  add column if not exists requirements jsonb not null default '[]'::jsonb;
