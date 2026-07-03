-- ============================================================================
-- PAINEL VIOFILME — CRM: formulários públicos de captura de leads
--
-- Cada formulário tem uma URL pública (/captura/<slug>) que cria um lead
-- (empresa + contato + negócio) no CRM. Leitura pública por slug é feita com
-- service-role no servidor (não expõe a tabela via RLS).
-- ============================================================================
create table if not exists public.crm_capture_forms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  owner text,                         -- responsável padrão dos leads (vazio = rodízio)
  source text default 'Formulário',   -- origem gravada no negócio
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_capture_forms_slug_idx
  on public.crm_capture_forms (lower(slug));

insert into public.crm_capture_forms (name, slug, source)
select 'Fale com a gente', 'fale-com-a-gente', 'Site'
where not exists (select 1 from public.crm_capture_forms);

alter table public.crm_capture_forms enable row level security;

drop policy if exists "gerencial gerencia crm_capture_forms" on public.crm_capture_forms;
create policy "gerencial gerencia crm_capture_forms" on public.crm_capture_forms
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.crm_capture_forms to anon, authenticated, service_role;
