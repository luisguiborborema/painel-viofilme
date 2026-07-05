-- ============================================================================
-- PAINEL VIOFILME — Playbooks (central de documentos por setor)
--
-- playbook_sectors : áreas/setores (Operações, Comercial…).
-- playbooks        : documentos em Markdown ou HTML, dentro de um setor.
--                    Ex.: Operações > Onboarding.
-- Interno (gerencial).
-- ============================================================================
create table if not exists public.playbook_sectors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.playbooks (
  id uuid primary key default gen_random_uuid(),
  sector_id uuid not null references public.playbook_sectors (id) on delete cascade,
  title text not null,
  content text not null default '',
  format text not null default 'md',   -- md | html
  position int not null default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists playbooks_sector_idx on public.playbooks (sector_id, position);

-- Seed de exemplo: Operações > Onboarding
insert into public.playbook_sectors (name, position)
select 'Operações', 1
where not exists (select 1 from public.playbook_sectors);

insert into public.playbooks (sector_id, title, content, format, position)
select s.id,
  'Onboarding de cliente',
  '# Onboarding de cliente

Passo a passo para iniciar um novo cliente na Viofilme.

## 1. Kickoff
- Reunião de alinhamento (objetivos, acessos, cronograma)
- Coletar acessos (Meta, Google, site)

## 2. Setup
- Criar projeto no painel
- Configurar integrações (Meta, WhatsApp)

## 3. Primeira entrega
- Linha editorial aprovada
- Primeira leva de criativos

> Dica: registre tudo no CRM e no Painel de Entregas.',
  'md', 1
from (select id from public.playbook_sectors order by position limit 1) s
where not exists (select 1 from public.playbooks);

alter table public.playbook_sectors enable row level security;
alter table public.playbooks        enable row level security;

drop policy if exists "gerencial gerencia playbook_sectors" on public.playbook_sectors;
create policy "gerencial gerencia playbook_sectors" on public.playbook_sectors
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

drop policy if exists "gerencial gerencia playbooks" on public.playbooks;
create policy "gerencial gerencia playbooks" on public.playbooks
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.playbook_sectors to anon, authenticated, service_role;
grant all on public.playbooks        to anon, authenticated, service_role;
