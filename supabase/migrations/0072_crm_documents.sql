-- 0072_crm_documents.sql
-- Documentos do Comercial: arquivos por NEGÓCIO (e/ou EMPRESA) — contratos,
-- propostas, briefings, materiais. Upload manual pelo gerencial (bucket via
-- /api/gerencial/task-upload); metadados aqui. Alimenta a aba Documentos do CRM
-- e a aba "Arquivos" da ficha do lead.

create table if not exists public.crm_documents (
  id         uuid primary key default gen_random_uuid(),
  deal_id    uuid references public.crm_leads(id) on delete cascade,
  company_id uuid references public.crm_companies(id) on delete cascade,
  title      text not null,
  url        text not null,
  file_name  text,
  file_type  text,
  file_size  bigint,
  kind       text not null default 'outro',  -- contrato|proposta|briefing|material|outro
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists crm_documents_deal_idx    on public.crm_documents (deal_id, created_at desc);
create index if not exists crm_documents_company_idx on public.crm_documents (company_id, created_at desc);

alter table public.crm_documents enable row level security;
drop policy if exists "gerencial gerencia crm_documents" on public.crm_documents;
create policy "gerencial gerencia crm_documents" on public.crm_documents
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
