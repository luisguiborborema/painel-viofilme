-- 0114_client_accesses.sql
-- Cofre de acessos por cliente (Meta/Google/WordPress/loja…). Antes era mock e
-- ficava vazio em produção. Só campos de exibição (sem senha) — a linha é
-- legível pelo próprio cliente no portal.

create table if not exists public.client_accesses (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.clients(id) on delete cascade,
  name        text not null,
  description text,
  icon        text not null default 'other',        -- meta|google|rd|wordpress|ecommerce|other
  status      text not null default 'connected',     -- connected|review|soon|setup
  note        text,
  url         text,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists client_accesses_client_idx
  on public.client_accesses (client_id, position);

alter table public.client_accesses enable row level security;

-- Cliente lê os próprios acessos; gerencial vê tudo.
drop policy if exists "lê acessos do próprio cliente" on public.client_accesses;
create policy "lê acessos do próprio cliente" on public.client_accesses
  for select using (public.app_role() = 'gerencial' or client_id = public.app_client_id());

-- Só gerencial cria/edita/exclui.
drop policy if exists "gerencial gerencia acessos" on public.client_accesses;
create policy "gerencial gerencia acessos" on public.client_accesses
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
