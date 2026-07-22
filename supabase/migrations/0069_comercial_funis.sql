-- 0069_comercial_funis.sql
-- Backbone do módulo Comercial (viofilme_comercial_roadmap_mestre, decisões-mãe 7):
--   • Cadeia de funis: Pré-venda (SDR) → passagem de bastão → Vendas (Closer).
--     Um mesmo `deal` atravessa os funis trocando de pipeline_id, preservando timeline.
--   • Congelado/Arquivado: estado à parte de Perdido (frozen_at), reengajável.
--   • No-show: contador no card (não etapa), persiste ao voltar de estágio.
--   • Cadência amarrada à etapa: liga em "Tentativa de Contato", desliga em "Contactado".
--   • Passagem de bastão com parecer (aceite híbrido) ao dar Ganho na "Reunião Realizada".

begin;

-- ── 1. Novos campos do negócio (deal-level) ─────────────────────────────────
alter table public.crm_leads
  add column if not exists no_show_count  int not null default 0,
  add column if not exists frozen_at      timestamptz,          -- congelado/arquivado
  add column if not exists frozen_reason  text,
  add column if not exists origin_kind    text,                 -- inbound|outbound (define cadência)
  add column if not exists cadence_active boolean not null default false,
  add column if not exists cadence_step   int not null default 0,
  add column if not exists handoff_at     timestamptz,
  add column if not exists handoff_result text,                 -- aceito|recusado
  add column if not exists handoff_parecer text;

-- separar congelados do board é operação frequente
create index if not exists crm_leads_frozen_idx on public.crm_leads (frozen_at);

-- ── 2. Cadeia de funis: Pré-venda (SDR) + Vendas (Closer) ───────────────────
-- IDs fixos: referência estável na passagem de bastão e nos seeds.
insert into public.crm_pipelines (id, name, is_default, position) values
  ('11111111-1111-4111-8111-111111111111', 'Pré-venda (SDR)', true,  0),
  ('22222222-2222-4222-8222-222222222222', 'Vendas (Closer)', false, 1)
on conflict (id) do nothing;

-- o funil default passa a ser a Pré-venda; desmarca qualquer default legado.
update public.crm_pipelines set is_default = false
 where id <> '11111111-1111-4111-8111-111111111111' and is_default;

-- estágios da Pré-venda (SDR): Contactar Urgente (reservatório) → Tentativa de
-- Contato (cadência ON) → Contactado (cadência OFF) → Reunião Agendada (no-show)
-- → Reunião Realizada (passa bastão). Saídas: Perdido · Congelado (estado).
insert into public.crm_stages (pipeline_id, key, label, color, probability, position, kind)
values
  ('11111111-1111-4111-8111-111111111111','sdr_contactar_urgente','Contactar Urgente',  '#ef4444', 10, 1, 'open'),
  ('11111111-1111-4111-8111-111111111111','sdr_tentativa_contato','Tentativa de Contato','#f59e0b', 20, 2, 'open'),
  ('11111111-1111-4111-8111-111111111111','sdr_contactado',       'Contactado',         '#0ea5e9', 35, 3, 'open'),
  ('11111111-1111-4111-8111-111111111111','sdr_reuniao_agendada', 'Reunião Agendada',   '#8b5cf6', 55, 4, 'open'),
  ('11111111-1111-4111-8111-111111111111','sdr_reuniao_realizada','Reunião Realizada',  '#6366f1', 70, 5, 'open'),
  ('11111111-1111-4111-8111-111111111111','perdido',              'Perdido',            '#f43f5e', 0,  6, 'lost')
on conflict (pipeline_id, key) do nothing;

-- estágios da Vendas (Closer): Análise → Elaboração de Proposta → Reunião de
-- Proposta → Negociação → Ganho (dispara automações). Saídas: Perdido · Congelado.
insert into public.crm_stages (pipeline_id, key, label, color, probability, position, kind)
values
  ('22222222-2222-4222-8222-222222222222','vnd_analise',         'Análise de Oportunidade','#64748b', 30, 1, 'open'),
  ('22222222-2222-4222-8222-222222222222','vnd_proposta',        'Elaboração de Proposta', '#8b5cf6', 50, 2, 'open'),
  ('22222222-2222-4222-8222-222222222222','vnd_reuniao_proposta','Reunião de Proposta',    '#0ea5e9', 65, 3, 'open'),
  ('22222222-2222-4222-8222-222222222222','vnd_negociacao',      'Negociação',             '#f59e0b', 80, 4, 'open'),
  ('22222222-2222-4222-8222-222222222222','ganho',               'Ganho',                  '#10b981', 100,5, 'won'),
  ('22222222-2222-4222-8222-222222222222','perdido',             'Perdido',                '#f43f5e', 0,  6, 'lost')
on conflict (pipeline_id, key) do nothing;

-- ── 3. Migração dos negócios legados p/ a cadeia nova ───────────────────────
-- Mapeia as keys do funil único (0016) para a etapa equivalente na cadeia.
-- Só toca negócios que ainda NÃO estão na cadeia nova (pipeline pre/vnd).
do $$
declare
  pre uuid := '11111111-1111-4111-8111-111111111111';
  vnd uuid := '22222222-2222-4222-8222-222222222222';
  none uuid := '00000000-0000-0000-0000-000000000000';
begin
  update public.crm_leads l
     set pipeline_id = pre, stage = 'sdr_contactar_urgente',
         stage_id = (select id from public.crm_stages where pipeline_id = pre and key = 'sdr_contactar_urgente')
   where l.stage = 'prospeccao' and coalesce(l.pipeline_id, none) not in (pre, vnd);

  update public.crm_leads l
     set pipeline_id = pre, stage = 'sdr_reuniao_agendada',
         stage_id = (select id from public.crm_stages where pipeline_id = pre and key = 'sdr_reuniao_agendada')
   where l.stage = 'reuniao' and coalesce(l.pipeline_id, none) not in (pre, vnd);

  update public.crm_leads l
     set pipeline_id = vnd, stage = 'vnd_proposta',
         stage_id = (select id from public.crm_stages where pipeline_id = vnd and key = 'vnd_proposta')
   where l.stage = 'proposta' and coalesce(l.pipeline_id, none) not in (pre, vnd);

  update public.crm_leads l
     set pipeline_id = vnd, stage = 'vnd_negociacao',
         stage_id = (select id from public.crm_stages where pipeline_id = vnd and key = 'vnd_negociacao')
   where l.stage = 'negociacao' and coalesce(l.pipeline_id, none) not in (pre, vnd);

  update public.crm_leads l
     set pipeline_id = vnd, stage = 'ganho',
         stage_id = (select id from public.crm_stages where pipeline_id = vnd and key = 'ganho')
   where l.stage = 'ganho' and coalesce(l.pipeline_id, none) not in (pre, vnd);

  update public.crm_leads l
     set pipeline_id = vnd, stage = 'perdido',
         stage_id = (select id from public.crm_stages where pipeline_id = vnd and key = 'perdido')
   where l.stage = 'perdido' and coalesce(l.pipeline_id, none) not in (pre, vnd);

  -- catch-all: qualquer negócio ABERTO ainda sem funil vai pro reservatório.
  update public.crm_leads l
     set pipeline_id = pre, stage = 'sdr_contactar_urgente',
         stage_id = (select id from public.crm_stages where pipeline_id = pre and key = 'sdr_contactar_urgente')
   where l.pipeline_id is null and l.stage not in ('ganho', 'perdido');
end $$;

-- Remove o funil legado (0016) já esvaziado — evita pipeline órfão no seletor.
-- Só apaga se nenhum negócio ainda o referencia (cascade levaria os estágios).
delete from public.crm_pipelines p
 where p.id not in (
     '11111111-1111-4111-8111-111111111111',
     '22222222-2222-4222-8222-222222222222')
   and not exists (select 1 from public.crm_leads l where l.pipeline_id = p.id);

commit;

-- PostgREST: recarregar o schema cache após a migração.
notify pgrst, 'reload schema';
