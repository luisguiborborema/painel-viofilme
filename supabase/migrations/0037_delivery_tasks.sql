-- 0037_delivery_tasks.sql
-- Painel de Entregas real: tarefas de produção da agência (arte/vídeo/copy/
-- tráfego), com estágio de produção, responsável, cliente e prazo. Alimenta o
-- board de Entregas, as entregas por cliente e o alerta de tarefas do cron.

create table if not exists public.delivery_tasks (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  client_id  uuid references public.clients(id) on delete set null,
  type       text not null default 'Arte',            -- Arte|Vídeo|Copy|Tráfego
  origin     text not null default 'Linha editorial', -- Linha editorial|Projeto|Tarefa avulsa
  assignee   text,                                    -- nome do responsável
  stage      text not null default 'todo',            -- todo|doing|review|approval|done
  due_date   date,
  estimate_h numeric(5,1) not null default 0,
  logged_h   numeric(5,1) not null default 0,
  urgent     boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists delivery_tasks_stage_idx on public.delivery_tasks (stage);
create index if not exists delivery_tasks_due_idx on public.delivery_tasks (due_date);
create index if not exists delivery_tasks_client_idx on public.delivery_tasks (client_id);

alter table public.delivery_tasks enable row level security;

-- Só o gerencial gerencia as entregas.
drop policy if exists "gerencial gerencia entregas" on public.delivery_tasks;
create policy "gerencial gerencia entregas" on public.delivery_tasks
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
