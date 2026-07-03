-- ============================================================================
-- PAINEL VIOFILME — CRM: permissões por dono (RLS) nos NEGÓCIOS
--
-- Gestor (allowed_sections null OU team_role='gestor') vê/edita TODOS os
-- negócios. Demais gerenciais (vendedores) veem/editam só os PRÓPRIOS
-- (owner = seu nome) e os NÃO ATRIBUÍDOS (pool). Empresas, contatos, tarefas e
-- interações continuam visíveis a todo gerencial (entidades compartilhadas).
--
-- Para reverter ao comportamento antigo (todo gerencial vê tudo), recrie a
-- policy de crm_leads como no 0009. Escrita via webhook/cron usa service-role
-- (bypassa RLS), então segue funcionando.
-- ============================================================================

-- Nome completo do usuário logado (para casar com crm_leads.owner).
create or replace function public.app_full_name()
returns text
language sql stable security definer set search_path = public as $$
  select full_name from public.profiles where id = auth.uid()
$$;

-- É gestor / acesso total?
create or replace function public.app_is_manager()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(allowed_sections is null or team_role = 'gestor', false)
  from public.profiles where id = auth.uid()
$$;

-- crm_leads: escopo por dono.
drop policy if exists "gerencial gerencia leads" on public.crm_leads;
drop policy if exists "crm_leads_owner_scope" on public.crm_leads;
create policy "crm_leads_owner_scope" on public.crm_leads
  for all using (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or owner = public.app_full_name()
      or owner is null
    )
  )
  with check (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or owner = public.app_full_name()
      or owner is null
    )
  );

-- crm_tasks: segue a visibilidade do negócio a que pertence.
drop policy if exists "gerencial gerencia tarefas" on public.crm_tasks;
drop policy if exists "crm_tasks_owner_scope" on public.crm_tasks;
create policy "crm_tasks_owner_scope" on public.crm_tasks
  for all using (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or exists (
        select 1 from public.crm_leads l
        where l.id = crm_tasks.lead_id
          and (l.owner = public.app_full_name() or l.owner is null)
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
          and (l.owner = public.app_full_name() or l.owner is null)
      )
    )
  );

-- crm_interactions: idem.
drop policy if exists "gerencial gerencia interações" on public.crm_interactions;
drop policy if exists "crm_interactions_owner_scope" on public.crm_interactions;
create policy "crm_interactions_owner_scope" on public.crm_interactions
  for all using (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or exists (
        select 1 from public.crm_leads l
        where l.id = crm_interactions.lead_id
          and (l.owner = public.app_full_name() or l.owner is null)
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
          and (l.owner = public.app_full_name() or l.owner is null)
      )
    )
  );
