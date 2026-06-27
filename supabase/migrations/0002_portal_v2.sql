-- ============================================================================
-- PAINEL VIOFILME — Portal do cliente v2/v3
-- Campos de configuração por cliente (R05/CAM04/ORG06), métricas preferidas
-- por usuário (R02), reuniões + pauta (R08), e solicitações de reunião (R09)
-- e de conteúdo (C02). Mantém o padrão de RLS do 0001.
-- ============================================================================

-- Tipos -----------------------------------------------------------------------
create type public.client_type as enum ('lead_gen', 'ecommerce', 'local_business');
create type public.request_status as enum ('pending', 'scheduled', 'in_progress', 'done', 'declined');
create type public.urgency_level as enum ('normal', 'urgent');

-- Configuração por cliente ----------------------------------------------------
alter table public.clients
  add column if not exists has_paid_traffic boolean not null default false,
  add column if not exists client_type public.client_type not null default 'local_business',
  -- redes ativas controlam os cards de rede em Resultados (ORG06)
  add column if not exists active_networks public.platform[] not null default '{instagram,facebook}';

-- Métricas preferidas por usuário (R02 — Home v2, exatamente 4) ---------------
alter table public.profiles
  add column if not exists preferred_metrics text[] not null default '{engajamento,alcance,cpl,investimento}';

-- Arte/preview da peça para a pré-visualização modular (C03) ------------------
alter table public.content_posts
  add column if not exists creative_url text;

-- Reuniões (R08 — card → modal de pauta) -------------------------------------
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  join_url text,
  agenda text,                  -- pauta preparada pela equipe (R08)
  participants text[] not null default '{}',
  next_steps text,
  created_at timestamptz not null default now()
);

-- Solicitações de reunião (R09 — "Solicitar horário") ------------------------
create table if not exists public.meeting_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  subject text not null,
  preferred_at timestamptz,
  alternate_at timestamptz,
  participants text[] not null default '{}',
  notes text,
  urgency public.urgency_level not null default 'normal',
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Solicitações de conteúdo (C02 — "Solicitar conteúdo") ----------------------
create table if not exists public.content_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  requested_by uuid references auth.users (id) on delete set null,
  format public.media_type not null default 'image',
  networks public.platform[] not null default '{instagram}',
  desired_date date,
  desired_time text,
  subject text not null,
  description text,
  guideline text,
  reference_urls text[] not null default '{}',
  urgency public.urgency_level not null default 'normal',
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now()
);

-- Índices úteis ---------------------------------------------------------------
create index if not exists meetings_client_idx on public.meetings (client_id, starts_at);
create index if not exists meeting_requests_client_idx on public.meeting_requests (client_id, created_at desc);
create index if not exists content_requests_client_idx on public.content_requests (client_id, created_at desc);

-- ============================================================================
-- Row Level Security
-- Reuniões: gerencial gerencia; cliente lê as próprias.
-- Solicitações: gerencial gerencia; cliente lê e CRIA as próprias.
-- ============================================================================
alter table public.meetings          enable row level security;
alter table public.meeting_requests  enable row level security;
alter table public.content_requests  enable row level security;

-- meetings
create policy "lê por cliente" on public.meetings
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());
create policy "gerencial gerencia" on public.meetings
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- meeting_requests
create policy "lê por cliente" on public.meeting_requests
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());
create policy "cliente cria a própria solicitação" on public.meeting_requests
  for insert with check (
    public.app_role() = 'gerencial' or client_id = public.app_client_id()
  );
create policy "gerencial gerencia" on public.meeting_requests
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- content_requests
create policy "lê por cliente" on public.content_requests
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());
create policy "cliente cria a própria solicitação" on public.content_requests
  for insert with check (
    public.app_role() = 'gerencial' or client_id = public.app_client_id()
  );
create policy "gerencial gerencia" on public.content_requests
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');
