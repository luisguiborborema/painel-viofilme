-- 0082_comercial_documentos.sql
-- Documentos do Comercial (Camada 4) — arquivo TRANSACIONAL: o que o time envia,
-- negocia e assina (propostas, contratos, aditivos) + biblioteca de modelos +
-- materiais de venda. Distinto de Processos (Listas), que é conhecimento.
--
-- Reaproveita crm_documents (0072) como central de rastreio, ganhando status,
-- valor, datas do ciclo (enviado/visualizado/assinado/vencimento), responsável,
-- vínculo a modelo e id externo (ZapSign). Duas tabelas novas: modelos e
-- materiais de venda.

-- ── Modelos de documento (biblioteca reutilizável) ──────────────────────────
create table if not exists public.crm_document_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  kind        text not null default 'proposta',   -- proposta|contrato|apresentacao|termo|outro
  description text,
  content     text,                                -- corpo com variáveis {empresa}, {valor}…
  variables   jsonb not null default '[]',         -- ["empresa","valor",…] (derivadas do corpo)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Materiais de venda (apoio à negociação) ─────────────────────────────────
create table if not exists public.crm_sales_materials (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        text not null default 'outro',       -- case|portfolio|one_pager|apresentacao|comparativo|outro
  file_url    text,
  link        text,
  tags        text[] not null default '{}',        -- serviço/segmento
  usage_count int not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ── Central de rastreio: estende crm_documents ──────────────────────────────
alter table public.crm_documents
  add column if not exists status      text not null default 'draft', -- draft|sent|viewed|signed|refused|expired
  add column if not exists value       numeric,                        -- valor (quando proposta)
  add column if not exists owner       text,                           -- responsável (nome)
  add column if not exists content     text,                           -- corpo gerado a partir de um modelo
  add column if not exists template_id uuid references public.crm_document_templates(id) on delete set null,
  add column if not exists external_id text,                           -- id do documento na ZapSign
  add column if not exists sent_at     timestamptz,
  add column if not exists viewed_at   timestamptz,
  add column if not exists signed_at   timestamptz,
  add column if not exists expires_at  timestamptz;

-- Documentos gerados a partir de modelo não têm arquivo (só content) → url opcional.
alter table public.crm_documents alter column url drop not null;

create index if not exists crm_documents_status_idx on public.crm_documents (status, created_at desc);

-- ── RLS (gerencial) ─────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['crm_document_templates','crm_sales_materials'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format($p$create policy "gerencial gerencia %1$s" on public.%1$s
      for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial')$p$, t);
  end loop;
end $$;

-- ── Seed: modelos e materiais iniciais ──────────────────────────────────────
insert into public.crm_document_templates (name, kind, description, content, variables) values
  ('Proposta comercial padrão', 'proposta',
   'Modelo base de proposta para fee mensal.',
   'Proposta para {empresa}\n\nPlano: {pacote}\nEntregáveis: {entregaveis}\nInvestimento: {valor}/mês\n\nValidade: 7 dias.',
   '["empresa","pacote","entregaveis","valor"]'::jsonb),
  ('Contrato — fee mensal', 'contrato',
   'Contrato de prestação de serviço recorrente.',
   'Contrato entre Viofilme e {empresa}, no valor de {valor}/mês, referente ao pacote {pacote}.',
   '["empresa","valor","pacote"]'::jsonb)
on conflict do nothing;

insert into public.crm_sales_materials (title, kind, link, tags) values
  ('Cases de resultados — Tráfego', 'case', '#', array['trafego','resultados']),
  ('Apresentação institucional', 'apresentacao', '#', array['institucional']),
  ('One-pager — Gestão de Conteúdo', 'one_pager', '#', array['conteudo'])
on conflict do nothing;

notify pgrst, 'reload schema';
