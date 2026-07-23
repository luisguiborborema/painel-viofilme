-- 0081_listas.sql
-- Listas (banco de dados comercial). Esta spec detalha Pessoas e Empresas
-- (que reaproveitam crm_contacts/crm_companies + contadores derivados de
-- crm_leads/crm_tasks — sem tabela nova). Aqui criamos:
--   • saved_views  → visões salvas (conjuntos de condições) por usuário/escopo
--   • Produtos      → services / service_plans / packages / package_items (catálogo)
--   • Processos     → knowledge_categories / knowledge_pages / knowledge_attachments
-- Produtos e Processos entram como estrutura pronta (abas-casca); a UI rica
-- desses dois evolui depois sem nova migração.

-- ── Visões salvas (filtros nomeados de Pessoas/Empresas) ────────────────────
create table if not exists public.saved_views (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references public.profiles(id) on delete cascade,
  scope       text not null,                 -- pessoas|empresas
  name        text not null,
  conditions  jsonb not null default '[]',   -- [{field,op,value}]
  lens        text,                          -- com_negocio|sem_negocio|null
  is_shared   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists saved_views_owner_idx on public.saved_views (owner_id, scope);

-- ── Produtos: catálogo (serviço › plano) + pacotes montados ─────────────────
create table if not exists public.services (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  category      text,                          -- ex.: Tráfego, Conteúdo, Web
  summary       text,                          -- resumo comercial (1 linha)
  description   text,                           -- ficha rica (o que é / entrega / SLA)
  delivery_type text not null default 'recorrente', -- recorrente|projeto|avulso
  active        boolean not null default true,
  position      int not null default 0,
  properties    jsonb not null default '{}',    -- juridico/operacional/observações
  created_at    timestamptz not null default now()
);

create table if not exists public.service_plans (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references public.services(id) on delete cascade,
  name          text not null,                  -- ex.: Essencial, Pro, Enterprise
  cadence       text not null default 'mensal', -- mensal|trimestral|unico|avulso
  price_cents   int,                            -- receita (o que o cliente paga)
  cost_cents    int,                            -- custo interno estimado
  billing_type  text not null default 'fixo',   -- fixo|midia_a_parte
  deliverables  jsonb not null default '[]',    -- [{label, qty}]
  notes         text,
  active        boolean not null default true,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists service_plans_service_idx on public.service_plans (service_id);

create table if not exists public.packages (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  client_hint       text,                       -- pra quem foi montado (texto livre)
  deal_id           uuid references public.crm_leads(id) on delete set null,
  notes             text,
  billing_type      text not null default 'fixo', -- fixo|midia_a_parte
  status            text not null default 'rascunho', -- rascunho|enviado|fechado
  owner_id          uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table if not exists public.package_items (
  id               uuid primary key default gen_random_uuid(),
  package_id       uuid not null references public.packages(id) on delete cascade,
  service_plan_id  uuid references public.service_plans(id) on delete set null,
  label            text not null,               -- snapshot do nome (serviço › plano)
  qty              int not null default 1,
  price_cents      int,
  cost_cents       int,
  position         int not null default 0
);
create index if not exists package_items_package_idx on public.package_items (package_id);

-- ── Processos: base de conhecimento (mural de cards) ────────────────────────
create table if not exists public.knowledge_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text not null default '#2a63c9',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists public.knowledge_pages (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid references public.knowledge_categories(id) on delete set null,
  title       text not null,
  summary     text,
  content     text,                              -- markdown/rich text simples
  tags        text[] not null default '{}',
  video_url   text,
  owner_id    uuid references public.profiles(id) on delete set null,
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists knowledge_pages_category_idx on public.knowledge_pages (category_id);

create table if not exists public.knowledge_attachments (
  id          uuid primary key default gen_random_uuid(),
  page_id     uuid not null references public.knowledge_pages(id) on delete cascade,
  kind        text not null default 'link',      -- file|link|video
  label       text,
  url         text not null,
  created_at  timestamptz not null default now()
);
create index if not exists knowledge_attachments_page_idx on public.knowledge_attachments (page_id);

-- ── RLS (gerencial) ─────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'saved_views','services','service_plans','packages','package_items',
    'knowledge_categories','knowledge_pages','knowledge_attachments'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format($p$create policy "gerencial gerencia %1$s" on public.%1$s
      for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial')$p$, t);
  end loop;
end $$;

-- ── Seed: categorias de conhecimento (mural inicial) ────────────────────────
insert into public.knowledge_categories (name, color, position) values
  ('Onboarding', '#2a63c9', 0),
  ('Playbooks de venda', '#0f9d58', 1),
  ('Operacional', '#f4b400', 2),
  ('Institucional', '#7c4dff', 3)
on conflict do nothing;
