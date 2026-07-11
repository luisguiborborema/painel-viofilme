-- 0030_crm_assignees_rls.sql
-- Múltiplos responsáveis no RLS: um vendedor (não-gestor) enxerga o negócio se
-- for o `owner` OU estiver em `assignees` (2º, 3º responsável...). Antes só o
-- owner via — quem era adicionado como responsável secundário ficava sem acesso.
-- Gestor continua vendo tudo; negócio sem dono (owner null) segue no pool.

-- crm_leads
drop policy if exists "crm_leads_owner_scope" on public.crm_leads;
create policy "crm_leads_owner_scope" on public.crm_leads
  for all using (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or owner = public.app_full_name()
      or public.app_full_name() = any (coalesce(assignees, '{}'::text[]))
      or owner is null
    )
  )
  with check (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or owner = public.app_full_name()
      or public.app_full_name() = any (coalesce(assignees, '{}'::text[]))
      or owner is null
    )
  );

-- crm_tasks: segue a visibilidade do negócio.
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
    )
  );

-- crm_interactions: idem.
drop policy if exists "crm_interactions_owner_scope" on public.crm_interactions;
create policy "crm_interactions_owner_scope" on public.crm_interactions
  for all using (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or exists (
        select 1 from public.crm_leads l
        where l.id = crm_interactions.lead_id
          and (
            l.owner = public.app_full_name()
            or public.app_full_name() = any (coalesce(l.assignees, '{}'::text[]))
            or l.owner is null
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
        where l.id = crm_interactions.lead_id
          and (
            l.owner = public.app_full_name()
            or public.app_full_name() = any (coalesce(l.assignees, '{}'::text[]))
            or l.owner is null
          )
      )
    )
  );
