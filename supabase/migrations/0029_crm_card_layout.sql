-- 0029_crm_card_layout.sql
-- Layout do card/modal do negócio: quais itens aparecem e em que ordem.
-- Configurado pelo Gestor (uma linha por object_type; hoje só 'deal').

create table if not exists public.crm_card_layout (
  object_type text primary key,
  -- [{ "key": "status", "visible": true }, ...] em ordem de exibição
  fields      jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.crm_card_layout enable row level security;

drop policy if exists "gerencial gerencia layout do card" on public.crm_card_layout;
create policy "gerencial gerencia layout do card" on public.crm_card_layout
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant select, insert, update, delete on public.crm_card_layout
  to anon, authenticated, service_role;
