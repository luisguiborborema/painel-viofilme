-- 0103_property_groups.sql
-- Propriedades no padrão HubSpot: grupos por objeto + description + required +
-- arquivar (soft delete). Idempotente e retrocompatível — o app grava/lê os
-- novos campos de forma TOLERANTE (funciona antes e depois desta migração).

-- Grupos de propriedades (por objeto): company | contact | deal | task
create table if not exists public.crm_property_groups (
  id          uuid primary key default gen_random_uuid(),
  object_type text not null,
  name        text not null,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists crm_property_groups_obj_idx
  on public.crm_property_groups (object_type, position);

-- Novos campos em crm_properties
alter table public.crm_properties
  add column if not exists group_id uuid references public.crm_property_groups(id) on delete set null,
  add column if not exists description text,
  add column if not exists required boolean not null default false,
  add column if not exists is_archived boolean not null default false;
