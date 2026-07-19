-- 0058_squads.sql
-- HUB00 · Modelar por squad desde já. Hoje existe um único squad, mas o schema
-- precisa suportar múltiplos para que nada quebre quando o 2º squad surgir.
-- O Hub organiza a visão por squad (meus / squad / todos).

create table if not exists public.squads (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  head_id    uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.clients  add column if not exists squad_id uuid references public.squads(id) on delete set null;
alter table public.profiles add column if not exists squad_id uuid references public.squads(id) on delete set null;
alter table public.profiles add column if not exists is_squad_head boolean not null default false;

-- Squad padrão + backfill (idempotente: só cria se ainda não houver squad).
insert into public.squads (name)
select 'Produção'
where not exists (select 1 from public.squads);

update public.clients
   set squad_id = (select id from public.squads order by created_at limit 1)
 where squad_id is null;

update public.profiles
   set squad_id = (select id from public.squads order by created_at limit 1)
 where squad_id is null and role = 'gerencial';

create index if not exists clients_squad_idx  on public.clients  (squad_id);
create index if not exists profiles_squad_idx on public.profiles (squad_id);

alter table public.squads enable row level security;
drop policy if exists "gerencial lê squads" on public.squads;
create policy "gerencial lê squads" on public.squads
  for select using (public.app_role() = 'gerencial');
drop policy if exists "gerencial gerencia squads" on public.squads;
create policy "gerencial gerencia squads" on public.squads
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
