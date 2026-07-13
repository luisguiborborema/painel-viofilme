-- 0034_crm_comments_rls.sql
-- Corrige o escopo dos comentários: a policy do 0027 só exigia app_role='gerencial',
-- deixando qualquer vendedor ler/escrever comentários em negócios que ele NÃO
-- enxerga (o negócio em si já é escopado por dono/responsável no 0030).
-- Aqui espelhamos exatamente a regra de crm_tasks/crm_interactions: gestor vê tudo;
-- os demais só nos negócios em que são owner, estão em assignees, ou sem dono.

drop policy if exists "gerencial gerencia comentários" on public.crm_comments;
drop policy if exists "crm_comments_deal_scope" on public.crm_comments;

create policy "crm_comments_deal_scope" on public.crm_comments
  for all using (
    public.app_role() = 'gerencial'
    and (
      public.app_is_manager()
      or exists (
        select 1 from public.crm_leads l
        where l.id = crm_comments.lead_id
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
        where l.id = crm_comments.lead_id
          and (
            l.owner = public.app_full_name()
            or public.app_full_name() = any (coalesce(l.assignees, '{}'::text[]))
            or l.owner is null
          )
      )
    )
  );
