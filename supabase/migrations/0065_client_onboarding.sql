-- 0065_client_onboarding.sql
-- Novo Cliente (cadastro manual) — cadeia de alocação por LINHA DE SERVIÇO.
-- Corrige a decisão-mãe nº4: squad deixa de ser único no cliente e passa a ser
-- por serviço recorrente (um cliente pode ter vários squads/áreas).
--
-- Área = automática do serviço · Squad = escolha manual do gestor (recorrente) ·
-- Analista = líder aloca depois (opcional) · Pontual usa executor + PO.
-- Pessoas dos dropdowns vêm de public.profiles (não há tabela employees aqui).

-- Redes ativas (Bloco 7) exige mais que instagram/facebook. Amplia o enum.
alter type public.platform add value if not exists 'tiktok';
alter type public.platform add value if not exists 'linkedin';
alter type public.platform add value if not exists 'youtube';
alter type public.platform add value if not exists 'google_business';

-- Área no squad (Social | Performance | Conteúdo | Criação | Audiovisual ...).
alter table public.squads add column if not exists area text;

-- Aptidão de PO no funcionário (flag, não cargo).
alter table public.profiles add column if not exists can_be_po boolean not null default false;

-- Campos de operação/atendimento no cliente.
alter table public.clients add column if not exists kickoff_date  date;
alter table public.clients add column if not exists cs_main_id    uuid references public.profiles(id) on delete set null;
alter table public.clients add column if not exists cs_support_id uuid references public.profiles(id) on delete set null;

-- Catálogo de serviços.
create table if not exists public.services (
  id     uuid primary key default gen_random_uuid(),
  label  text not null,
  type   text not null,               -- recorrente | pontual
  area   text not null,               -- Social | Performance | Conteúdo | Criação | Audiovisual
  sort   integer not null default 0,
  active boolean not null default true,
  unique (label)
);

-- Planos por serviço (também servem de "Formato" no pontual).
create table if not exists public.service_plans (
  id            uuid primary key default gen_random_uuid(),
  service_id    uuid not null references public.services(id) on delete cascade,
  label         text not null,
  default_price numeric(12,2) not null default 0,
  sort          integer not null default 0,
  unique (service_id, label)
);

-- Serviços contratados por cliente (uma linha por serviço).
create table if not exists public.client_services (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  service_id  uuid references public.services(id) on delete set null,
  plan_id     uuid references public.service_plans(id) on delete set null,
  type        text not null,                         -- recorrente | pontual (redundância controlada)
  base_value  numeric(12,2) not null default 0,
  discount    numeric(12,2) not null default 0,
  final_value numeric(12,2) not null default 0,      -- base - discount (persistido p/ Financeiro)
  squad_id    uuid references public.squads(id) on delete set null,     -- obrigatório se recorrente
  analyst_id  uuid references public.profiles(id) on delete set null,   -- opcional
  executor_id uuid references public.profiles(id) on delete set null,   -- pontual: responsável técnico
  po_id       uuid references public.profiles(id) on delete set null,   -- pontual: PO do projeto
  created_at  timestamptz not null default now()
);
create index if not exists client_services_client_idx on public.client_services (client_id);
create index if not exists client_services_squad_idx  on public.client_services (squad_id);

-- Contatos do cliente (múltiplos).
create table if not exists public.client_contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  name       text not null,
  role       text,
  whatsapp   text,
  email      text,
  is_primary boolean not null default false,
  sort       integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists client_contacts_client_idx on public.client_contacts (client_id);

-- RLS ------------------------------------------------------------------------
alter table public.services        enable row level security;
alter table public.service_plans   enable row level security;
alter table public.client_services enable row level security;
alter table public.client_contacts enable row level security;

do $$
declare t text;
begin
  foreach t in array array['services','service_plans','client_services','client_contacts']
  loop
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format('create policy "gerencial gerencia %1$s" on public.%1$s for all using (public.app_role() = ''gerencial'') with check (public.app_role() = ''gerencial'')', t);
  end loop;
end $$;

-- Seed do catálogo (placeholder — nomes reais a confirmar). Idempotente. -------
update public.squads set area = 'Social' where area is null;

insert into public.squads (name, area) values
  ('Squad Alpha', 'Social'),
  ('Squad Beta', 'Social'),
  ('Tráfego 1', 'Performance'),
  ('Tráfego 2', 'Performance'),
  ('UGC', 'Conteúdo')
on conflict do nothing;

insert into public.services (label, type, area, sort) values
  ('Social Media', 'recorrente', 'Social', 1),
  ('Tráfego Pago', 'recorrente', 'Performance', 2),
  ('UGC', 'recorrente', 'Conteúdo', 3),
  ('Identidade Visual', 'pontual', 'Criação', 1),
  ('Vídeo Institucional', 'pontual', 'Audiovisual', 2),
  ('Website', 'pontual', 'Criação', 3)
on conflict (label) do nothing;

insert into public.service_plans (service_id, label, default_price, sort)
select s.id, p.label, p.price, p.sort
from public.services s
join (values
  ('Social Media', 'Essencial', 1500, 1),
  ('Social Media', 'Pro', 2800, 2),
  ('Social Media', 'Premium', 4500, 3),
  ('Tráfego Pago', 'Gestão Start', 1200, 1),
  ('Tráfego Pago', 'Gestão Full', 2500, 2),
  ('UGC', '4 vídeos/mês', 1800, 1),
  ('UGC', '8 vídeos/mês', 3200, 2),
  ('Identidade Visual', 'Básica', 3500, 1),
  ('Identidade Visual', 'Completa', 6500, 2),
  ('Vídeo Institucional', '1 vídeo', 4000, 1),
  ('Vídeo Institucional', 'Pacote 3', 9000, 2),
  ('Website', 'Landing page', 3500, 1),
  ('Website', 'Institucional', 8000, 2)
) as p(service_label, label, price, sort) on p.service_label = s.label
on conflict (service_id, label) do nothing;
