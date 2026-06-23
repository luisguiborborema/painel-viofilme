-- ============================================================================
-- PAINEL VIOFILME — Schema inicial
-- Acessos: gerencial (agência) e cliente. RLS isola dados por cliente.
-- ============================================================================

-- Tipos -----------------------------------------------------------------------
create type public.user_role as enum ('gerencial', 'cliente');
create type public.platform as enum ('instagram', 'facebook');
create type public.post_status as enum ('published', 'scheduled', 'draft');
create type public.media_type as enum ('image', 'video', 'carousel', 'reel', 'story');
create type public.campaign_status as enum ('active', 'paused', 'ended', 'draft');

-- Clientes (empresas atendidas pela agência) ---------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  segment text,
  instagram_username text,
  facebook_page_name text,
  status text not null default 'ativo',
  monthly_fee numeric(12,2),
  created_at timestamptz not null default now()
);

-- Perfis (1:1 com auth.users) -------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'cliente',
  client_id uuid references public.clients (id) on delete set null,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- Conexões Meta (tokens OAuth do Instagram/Facebook por cliente) -------------
create table public.meta_connections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ig_user_id text,
  fb_page_id text,
  page_name text,
  access_token text,            -- token de longa duração (criptografe em prod)
  token_expires_at timestamptz,
  scopes text[],
  connected_at timestamptz not null default now(),
  unique (client_id)
);

-- Campanhas -------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  external_id text,             -- id da campanha na Meta Ads
  name text not null,
  objective text,
  platform public.platform,
  status public.campaign_status not null default 'active',
  budget numeric(12,2),
  spend numeric(12,2) not null default 0,
  start_date date,
  end_date date,
  created_at timestamptz not null default now()
);

-- Métricas diárias de campanha -----------------------------------------------
create table public.campaign_metrics (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  date date not null,
  impressions bigint not null default 0,
  reach bigint not null default 0,
  clicks bigint not null default 0,
  spend numeric(12,2) not null default 0,
  conversions bigint not null default 0,
  unique (campaign_id, date)
);

-- Conteúdo (posts publicados/agendados no IG/FB) -----------------------------
create table public.content_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  external_id text,             -- id da mídia na Graph API
  platform public.platform not null,
  media_type public.media_type not null default 'image',
  status public.post_status not null default 'published',
  caption text,
  permalink text,
  media_url text,
  thumbnail_url text,
  published_at timestamptz,
  scheduled_at timestamptz,
  likes bigint not null default 0,
  comments bigint not null default 0,
  shares bigint not null default 0,
  saves bigint not null default 0,
  reach bigint not null default 0,
  impressions bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Métricas diárias da conta (seguidores, alcance) ----------------------------
create table public.account_metrics (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  platform public.platform not null,
  date date not null,
  followers bigint not null default 0,
  reach bigint not null default 0,
  impressions bigint not null default 0,
  profile_views bigint not null default 0,
  unique (client_id, platform, date)
);

-- Índices úteis ---------------------------------------------------------------
create index on public.campaigns (client_id);
create index on public.campaign_metrics (campaign_id, date);
create index on public.content_posts (client_id, published_at desc);
create index on public.account_metrics (client_id, date);

-- ============================================================================
-- Funções auxiliares (SECURITY DEFINER evita recursão de RLS em profiles)
-- ============================================================================
create or replace function public.app_role()
returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.app_client_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select client_id from public.profiles where id = auth.uid()
$$;

-- Cria profile automaticamente quando um usuário é criado no Auth ------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'cliente')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Row Level Security
-- Regra geral: gerencial vê/edita tudo; cliente vê apenas o próprio client_id.
-- ============================================================================
alter table public.clients          enable row level security;
alter table public.profiles         enable row level security;
alter table public.meta_connections enable row level security;
alter table public.campaigns        enable row level security;
alter table public.campaign_metrics enable row level security;
alter table public.content_posts    enable row level security;
alter table public.account_metrics  enable row level security;

-- profiles
create policy "perfil próprio ou gerencial lê tudo" on public.profiles
  for select using (id = auth.uid() or public.app_role() = 'gerencial');
create policy "edita o próprio perfil" on public.profiles
  for update using (id = auth.uid());
create policy "gerencial gerencia perfis" on public.profiles
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

-- clients
create policy "lê o próprio cliente ou gerencial lê tudo" on public.clients
  for select using (public.app_role() = 'gerencial' or id = public.app_client_id());
create policy "gerencial gerencia clientes" on public.clients
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

-- Macro de políticas para tabelas com client_id direto
create policy "lê por cliente" on public.meta_connections
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());
create policy "gerencial gerencia" on public.meta_connections
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

create policy "lê por cliente" on public.campaigns
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());
create policy "gerencial gerencia" on public.campaigns
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

create policy "lê por cliente" on public.content_posts
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());
create policy "gerencial gerencia" on public.content_posts
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

create policy "lê por cliente" on public.account_metrics
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());
create policy "gerencial gerencia" on public.account_metrics
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- campaign_metrics: deriva o cliente via campanha
create policy "lê por cliente (via campanha)" on public.campaign_metrics
  for select using (
    public.app_role() = 'gerencial'
    or exists (
      select 1 from public.campaigns c
      where c.id = campaign_metrics.campaign_id
        and c.client_id = public.app_client_id()
    )
  );
create policy "gerencial gerencia" on public.campaign_metrics
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');
