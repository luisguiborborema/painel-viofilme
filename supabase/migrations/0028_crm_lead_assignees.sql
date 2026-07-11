-- 0028_crm_lead_assignees.sql
-- Múltiplos responsáveis por negócio. `owner` (texto) segue como o responsável
-- primário (governa RLS/rodízio) e é sempre o assignees[0].

alter table public.crm_leads
  add column if not exists assignees text[] not null default '{}'::text[];

-- Backfill: quem já tinha owner vira o primeiro responsável.
update public.crm_leads
  set assignees = array[owner]
  where owner is not null and owner <> '' and (assignees is null or cardinality(assignees) = 0);
