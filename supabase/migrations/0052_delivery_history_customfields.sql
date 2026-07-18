-- 0052_delivery_history_customfields.sql
-- Card de tarefa v2 — Fase 3: histórico de etapa (cycle time / tarefa parada)
-- e campos personalizados por board (modelo Sprints).

alter table public.delivery_tasks
  add column if not exists moved_at      timestamptz not null default now(),
  add column if not exists custom_fields jsonb not null default '{}'::jsonb;

-- Histórico de transições de etapa (populado por trigger) ---------------------
create table if not exists public.delivery_task_status_history (
  id          bigint generated always as identity primary key,
  task_id     uuid not null references public.delivery_tasks(id) on delete cascade,
  from_status text,
  to_status   text not null,
  changed_at  timestamptz not null default now(),
  changed_by  uuid
);
create index if not exists delivery_status_history_task_idx
  on public.delivery_task_status_history (task_id, changed_at desc);

alter table public.delivery_task_status_history enable row level security;
drop policy if exists "gerencial lê histórico de etapa" on public.delivery_task_status_history;
create policy "gerencial lê histórico de etapa" on public.delivery_task_status_history
  for select using (public.app_role() = 'gerencial');

create or replace function public.log_delivery_task_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.delivery_task_status_history(task_id, from_status, to_status, changed_at, changed_by)
    values (new.id, null, new.stage, coalesce(new.created_at, now()), auth.uid());
  elsif tg_op = 'UPDATE' and new.stage is distinct from old.stage then
    new.moved_at := now();
    insert into public.delivery_task_status_history(task_id, from_status, to_status, changed_at, changed_by)
    values (new.id, old.stage, new.stage, now(), auth.uid());
  end if;
  return new;
end; $$;

drop trigger if exists trg_delivery_status_ins on public.delivery_tasks;
create trigger trg_delivery_status_ins after insert on public.delivery_tasks
  for each row execute function public.log_delivery_task_status();
drop trigger if exists trg_delivery_status_upd on public.delivery_tasks;
create trigger trg_delivery_status_upd before update on public.delivery_tasks
  for each row execute function public.log_delivery_task_status();

-- Campos personalizados por board ---------------------------------------------
create table if not exists public.delivery_form_fields (
  id         uuid primary key default gen_random_uuid(),
  board      text not null default 'entregas',
  field_key  text not null,
  label      text not null,
  field_type text not null default 'text',   -- text|textarea|number|select|date|checkbox|url
  options    jsonb not null default '[]'::jsonb,  -- [{value,label}] p/ select
  required   boolean not null default false,
  position   integer not null default 0,
  active     boolean not null default true,
  unique (board, field_key)
);

alter table public.delivery_form_fields enable row level security;
drop policy if exists "gerencial gerencia campos" on public.delivery_form_fields;
create policy "gerencial gerencia campos" on public.delivery_form_fields
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
