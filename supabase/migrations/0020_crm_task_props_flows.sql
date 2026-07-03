-- ============================================================================
-- PAINEL VIOFILME — CRM: propriedades em tarefas + fluxos de tarefas
--
-- crm_tasks.properties : valores das propriedades customizadas (object_type
--                        'task' em crm_properties).
-- crm_tasks.assignee   : responsável específico da tarefa (senão = dono do deal).
-- crm_task_flows(+steps): "fluxos" (playbooks) — conjuntos ordenados de tarefas
--                        que podem ser aplicados de uma vez a um negócio.
-- ============================================================================

alter table public.crm_tasks
  add column if not exists properties jsonb not null default '{}'::jsonb,
  add column if not exists assignee text;

create table if not exists public.crm_task_flows (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.crm_task_flow_steps (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.crm_task_flows (id) on delete cascade,
  position int not null default 0,
  title text not null,
  due_days int not null default 1,   -- vencimento = hoje + due_days
  created_at timestamptz not null default now()
);
create index if not exists crm_task_flow_steps_flow_idx
  on public.crm_task_flow_steps (flow_id, position);

-- Fluxo de exemplo: cadência de prospecção.
insert into public.crm_task_flows (name)
select 'Cadência de prospecção'
where not exists (select 1 from public.crm_task_flows);

insert into public.crm_task_flow_steps (flow_id, position, title, due_days)
select f.id, v.position, v.title, v.due_days
from (select id from public.crm_task_flows order by created_at limit 1) f
cross join (values
  (1, 'Primeira ligação de abordagem', 0),
  (2, 'Enviar material por WhatsApp', 1),
  (3, 'Follow-up da proposta', 3),
  (4, 'Última tentativa de contato', 7)
) as v(position, title, due_days)
where not exists (select 1 from public.crm_task_flow_steps);

-- RLS + grants
alter table public.crm_task_flows      enable row level security;
alter table public.crm_task_flow_steps enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crm_task_flows','crm_task_flow_steps'] loop
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format($f$
      create policy "gerencial gerencia %1$s" on public.%1$s
        for all using (public.app_role() = 'gerencial')
        with check (public.app_role() = 'gerencial')
    $f$, t);
    execute format('grant all on public.%1$s to anon, authenticated, service_role', t);
  end loop;
end $$;
