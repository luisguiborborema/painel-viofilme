-- ============================================================================
-- PAINEL VIOFILME — CRM v2 (modelo HubSpot: Empresa · Contato · Deal)
--
-- Evolui o CRM plano (crm_leads mistura empresa+contato+negócio) para o modelo
-- de objetos do HubSpot:
--   crm_companies      : empresas (registros reutilizáveis)
--   crm_contacts       : pessoas (ligadas a uma empresa)
--   crm_leads          : DEALS/negócios (mantém o nome da tabela p/ não quebrar
--                        as FKs de crm_interactions/crm_tasks); ganha company_id,
--                        primary_contact_id, pipeline_id, stage_id, tags, properties
--   crm_deal_contacts  : associação N:N deal ↔ contatos
--   crm_pipelines      : funis (por ora um "default")
--   crm_stages         : estágios editáveis (label, cor, probabilidade, ordem)
--   crm_properties     : definições de propriedades customizadas por objeto
--   crm_tags           : tags com cor (reutilizáveis)
--
-- Propriedades customizadas ficam em colunas `properties jsonb` de cada objeto;
-- `crm_properties` descreve as chaves/tipos/UI. Tags ficam em `tags text[]`
-- (ids de crm_tags) em cada objeto.
--
-- CRM é 100% interno (gerencial). Webhook (Uazapi) grava via service_role.
-- Idempotente: pode rodar mais de uma vez sem duplicar.
-- ============================================================================

-- ── Pipelines & estágios ────────────────────────────────────────────────────
create table if not exists public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references public.crm_pipelines (id) on delete cascade,
  key text not null,                         -- estável (usado no código/back-compat)
  label text not null,
  color text not null default '#64748b',     -- hex da cor do estágio
  probability int not null default 0,        -- 0..100 (peso do pipeline)
  position int not null default 0,
  kind text not null default 'open',         -- open|won|lost
  created_at timestamptz not null default now()
);
create index if not exists crm_stages_pipeline_idx
  on public.crm_stages (pipeline_id, position);
create unique index if not exists crm_stages_pipeline_key_idx
  on public.crm_stages (pipeline_id, key);

-- Seed do pipeline default + estágios equivalentes aos fixos de hoje.
insert into public.crm_pipelines (name, is_default, position)
select 'Pipeline comercial', true, 0
where not exists (select 1 from public.crm_pipelines where is_default);

insert into public.crm_stages (pipeline_id, key, label, color, probability, position, kind)
select p.id, v.key, v.label, v.color, v.probability, v.position, v.kind
from (select id from public.crm_pipelines where is_default order by position limit 1) p
cross join (values
  ('prospeccao', 'Prospecção',      '#64748b', 20, 1, 'open'),
  ('reuniao',    'Reunião marcada', '#0ea5e9', 40, 2, 'open'),
  ('proposta',   'Proposta enviada','#8b5cf6', 60, 3, 'open'),
  ('negociacao', 'Em negociação',   '#f59e0b', 75, 4, 'open'),
  ('ganho',      'Ganho',           '#10b981', 100,5, 'won'),
  ('perdido',    'Perdido',         '#f43f5e', 0,  6, 'lost')
) as v(key, label, color, probability, position, kind)
on conflict (pipeline_id, key) do nothing;

-- ── Empresas ────────────────────────────────────────────────────────────────
create table if not exists public.crm_companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text,
  website text,
  phone text,
  email text,
  city text,
  size text,                                 -- ex.: "1-10", "11-50"...
  owner text,
  tags text[] not null default '{}',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_companies_name_idx on public.crm_companies (lower(name));

-- ── Contatos ────────────────────────────────────────────────────────────────
create table if not exists public.crm_contacts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.crm_companies (id) on delete set null,
  name text not null,
  title text,                                -- cargo
  phone text,                                -- dígitos DDI+DDD (casa WhatsApp)
  email text,
  is_primary boolean not null default false,
  owner text,
  tags text[] not null default '{}',
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists crm_contacts_company_idx on public.crm_contacts (company_id);
create index if not exists crm_contacts_phone_idx on public.crm_contacts (phone);

-- ── Deals: evolui crm_leads ─────────────────────────────────────────────────
alter table public.crm_leads
  add column if not exists company_id uuid references public.crm_companies (id) on delete set null,
  add column if not exists primary_contact_id uuid references public.crm_contacts (id) on delete set null,
  add column if not exists pipeline_id uuid references public.crm_pipelines (id) on delete set null,
  add column if not exists stage_id uuid references public.crm_stages (id) on delete set null,
  add column if not exists tags text[] not null default '{}',
  add column if not exists properties jsonb not null default '{}'::jsonb;

-- ── Associação deal ↔ contatos (N:N) ────────────────────────────────────────
create table if not exists public.crm_deal_contacts (
  deal_id uuid not null references public.crm_leads (id) on delete cascade,
  contact_id uuid not null references public.crm_contacts (id) on delete cascade,
  role text,                                 -- papel na negociação (ex.: decisor)
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (deal_id, contact_id)
);
create index if not exists crm_deal_contacts_contact_idx
  on public.crm_deal_contacts (contact_id);

-- ── Propriedades customizadas (definições) ──────────────────────────────────
create table if not exists public.crm_properties (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,                 -- company|contact|deal
  key text not null,
  label text not null,
  field_type text not null default 'text',   -- text|number|currency|select|multiselect|date|checkbox|phone|email|url
  options jsonb not null default '[]'::jsonb, -- [{value,label,color?}] p/ select/multiselect
  position int not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_properties_obj_key_idx
  on public.crm_properties (object_type, key);

-- Algumas propriedades de exemplo (demonstram o recurso; editáveis/removíveis).
insert into public.crm_properties (object_type, key, label, field_type, options, position, is_default)
values
  ('company', 'instagram', 'Instagram', 'text', '[]'::jsonb, 1, true),
  ('company', 'cnpj', 'CNPJ', 'text', '[]'::jsonb, 2, true),
  ('contact', 'whatsapp_optin', 'Aceita WhatsApp', 'checkbox', '[]'::jsonb, 1, true),
  ('deal', 'concorrente', 'Concorrente atual', 'text', '[]'::jsonb, 1, true)
on conflict (object_type, key) do nothing;

-- ── Tags com cor ────────────────────────────────────────────────────────────
create table if not exists public.crm_tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#2a63c9',
  created_at timestamptz not null default now()
);
create unique index if not exists crm_tags_name_idx on public.crm_tags (lower(name));

insert into public.crm_tags (name, color) values
  ('Quente', '#f43f5e'),
  ('Indicação', '#10b981'),
  ('Enterprise', '#8b5cf6'),
  ('Retomar', '#f59e0b')
on conflict do nothing;

-- ============================================================================
-- BACKFILL — cria Empresa + Contato primário a partir de cada crm_lead legado
-- e vincula (company_id, primary_contact_id, pipeline_id, stage_id). Só age em
-- deals ainda sem company_id, então é seguro re-rodar.
-- ============================================================================
do $$
declare
  d record;
  v_company_id uuid;
  v_contact_id uuid;
  v_pipeline_id uuid;
  v_stage_id uuid;
begin
  select id into v_pipeline_id from public.crm_pipelines where is_default order by position limit 1;

  for d in select * from public.crm_leads where company_id is null loop
    -- Empresa
    insert into public.crm_companies (name, segment, phone, email, owner)
    values (coalesce(d.name, 'Empresa'), d.segment, d.contact_phone, d.contact_email, d.owner)
    returning id into v_company_id;

    -- Contato primário (se houver nome/telefone/e-mail)
    v_contact_id := null;
    if coalesce(d.contact_name, d.contact_phone, d.contact_email) is not null then
      insert into public.crm_contacts (company_id, name, phone, email, is_primary, owner)
      values (v_company_id, coalesce(d.contact_name, d.name, 'Contato'),
              d.contact_phone, d.contact_email, true, d.owner)
      returning id into v_contact_id;
    end if;

    -- Estágio correspondente pela key
    select id into v_stage_id from public.crm_stages
      where pipeline_id = v_pipeline_id and key = d.stage limit 1;

    update public.crm_leads
      set company_id = v_company_id,
          primary_contact_id = v_contact_id,
          pipeline_id = v_pipeline_id,
          stage_id = v_stage_id
      where id = d.id;

    -- Associação deal ↔ contato primário
    if v_contact_id is not null then
      insert into public.crm_deal_contacts (deal_id, contact_id, is_primary)
      values (d.id, v_contact_id, true)
      on conflict do nothing;
    end if;
  end loop;
end $$;

-- ── RLS + grants (gerencial gerencia tudo; service_role p/ webhooks) ─────────
alter table public.crm_pipelines     enable row level security;
alter table public.crm_stages        enable row level security;
alter table public.crm_companies     enable row level security;
alter table public.crm_contacts      enable row level security;
alter table public.crm_deal_contacts enable row level security;
alter table public.crm_properties    enable row level security;
alter table public.crm_tags          enable row level security;

do $$
declare t text;
begin
  foreach t in array array[
    'crm_pipelines','crm_stages','crm_companies','crm_contacts',
    'crm_deal_contacts','crm_properties','crm_tags'
  ] loop
    execute format(
      'drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format($f$
      create policy "gerencial gerencia %1$s" on public.%1$s
        for all using (public.app_role() = 'gerencial')
        with check (public.app_role() = 'gerencial')
    $f$, t);
    execute format(
      'grant all on public.%1$s to anon, authenticated, service_role', t);
  end loop;
end $$;
