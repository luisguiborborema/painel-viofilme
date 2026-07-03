-- ============================================================================
-- PAINEL VIOFILME — Integração Google Calendar (conta única da agência)
--
-- google_connections: guarda os tokens OAuth (uma linha, scope='agency').
-- O refresh_token permite renovar o acesso sem novo login.
-- Escrita via service_role (callback); leitura pelo gerencial.
-- ============================================================================

create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  scope text not null default 'agency',   -- 'agency' (conta única) — futuro: por usuário
  google_email text,
  access_token text,
  refresh_token text,
  token_expiry timestamptz,
  calendar_id text not null default 'primary',
  scopes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists google_connections_scope_idx
  on public.google_connections (scope);

alter table public.google_connections enable row level security;

create policy "gerencial lê conexão google" on public.google_connections
  for select using (public.app_role() = 'gerencial');

grant all on public.google_connections to anon, authenticated, service_role;
