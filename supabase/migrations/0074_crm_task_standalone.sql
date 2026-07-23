-- 0074_crm_task_standalone.sql
-- Tarefas avulsas (sem negócio) na Central de Atividades: lead_id passa a ser
-- opcional e o RLS permite ao usuário ver/gerenciar suas próprias avulsas
-- (além do escopo por negócio já existente na 0030).

alter table public.crm_tasks alter column lead_id drop not null;

drop policy if exists "crm_tasks_owner_scope" on public.crm_tasks;
create policy "crm_tasks_owner_scope" on public.crm_tasks
  for all using (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or exists (
        select 1 from public.crm_leads l
        where l.id = crm_tasks.lead_id
          and (
            l.owner = public.app_full_name()
            or public.app_full_name() = any (coalesce(l.assignees, '{}'::text[]))
            or l.owner is null
          )
      )
      or (
        crm_tasks.lead_id is null
        and (
          crm_tasks.assignee = public.app_full_name()
          or public.app_full_name() = any (coalesce(crm_tasks.assignees, '{}'::text[]))
        )
      )
    )
  )
  with check (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or exists (
        select 1 from public.crm_leads l
        where l.id = crm_tasks.lead_id
          and (
            l.owner = public.app_full_name()
            or public.app_full_name() = any (coalesce(l.assignees, '{}'::text[]))
            or l.owner is null
          )
      )
      or (
        crm_tasks.lead_id is null
        and (
          crm_tasks.assignee = public.app_full_name()
          or public.app_full_name() = any (coalesce(crm_tasks.assignees, '{}'::text[]))
        )
      )
    )
  );

notify pgrst, 'reload schema';
