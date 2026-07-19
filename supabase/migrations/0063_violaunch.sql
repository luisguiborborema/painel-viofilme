-- 0063_violaunch.sql
-- VioLaunch™ (HUB11 / VL) — Produto Zero persistido por cliente. As 5 entidades
-- do modelo do spec: projeto + jornada (12 passos) + sub-passos + 4 gates + 7
-- blocos do Roadmap. O conteúdo pesado (editor do Roadmap, sub-passos 4–12)
-- segue como placeholder que liga depois; a estrutura já é real e por cliente.

create table if not exists public.violaunch_projects (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  scope        text not null default 'completo',   -- completo | reduzido (futuro)
  start_date   text,
  current_step integer not null default 1,
  status       text not null default 'ativo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (client_id)
);

create table if not exists public.violaunch_steps (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.violaunch_projects(id) on delete cascade,
  step_number integer not null,                     -- 1..12
  week_title  text,
  name        text not null,
  responsible text,
  due_date    text,
  status      text not null default 'proximo',      -- concluido | andamento | proximo | bloqueado
  status_tag  text,
  connection  text,                                 -- vioday | le | agenda
  placeholder boolean not null default false,
  sla         text,
  unique (project_id, step_number)
);

create table if not exists public.violaunch_substeps (
  id            uuid primary key default gen_random_uuid(),
  step_id       uuid not null references public.violaunch_steps(id) on delete cascade,
  kind          text not null,                      -- action | resource
  content       text not null,
  done          boolean not null default false,     -- action: marcável
  resource_type text,                               -- resource: copiar | abrir | anexar
  resource_ref  text,                               -- copy (texto) ou URL
  sort          integer not null default 0
);

create table if not exists public.violaunch_gates (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.violaunch_projects(id) on delete cascade,
  gate_number integer not null,                     -- 1..4
  name        text not null,
  status      text not null default 'bloqueado',    -- liberado | validando | bloqueado
  rule        text,
  items       jsonb not null default '[]'::jsonb,   -- [{label, done}]
  unique (project_id, gate_number)
);

create table if not exists public.roadmap_blocks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.violaunch_projects(id) on delete cascade,
  block_code  text not null,                        -- B1..B7
  name        text not null,
  composition text,                                 -- T | P | T+P
  progress    integer not null default 0,
  sort        integer not null default 0,
  unique (project_id, block_code)
);

create index if not exists violaunch_steps_project_idx on public.violaunch_steps (project_id, step_number);
create index if not exists violaunch_gates_project_idx  on public.violaunch_gates (project_id, gate_number);
create index if not exists roadmap_blocks_project_idx   on public.roadmap_blocks (project_id, sort);

alter table public.violaunch_projects enable row level security;
alter table public.violaunch_steps    enable row level security;
alter table public.violaunch_substeps enable row level security;
alter table public.violaunch_gates    enable row level security;
alter table public.roadmap_blocks     enable row level security;

do $$
declare t text;
begin
  foreach t in array array['violaunch_projects','violaunch_steps','violaunch_substeps','violaunch_gates','roadmap_blocks']
  loop
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format(
      'create policy "gerencial gerencia %1$s" on public.%1$s for all using (public.app_role() = ''gerencial'') with check (public.app_role() = ''gerencial'')',
      t
    );
  end loop;
end $$;
