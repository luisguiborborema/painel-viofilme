-- 0115_rh_documents.sql
-- RH & Cultura — documentos admissionais por colaborador (contrato, holerite,
-- ASO, CND…). Espelha client_documents. Arquivos vão pro bucket wa-media
-- (prefixo task-files), como os demais anexos.

create table if not exists public.rh_documents (
  id              uuid primary key default gen_random_uuid(),
  collaborator_id uuid not null references public.collaborators(id) on delete cascade,
  title           text not null,
  file_name       text,
  url             text not null,
  file_type       text,
  file_size       bigint,
  kind            text not null default 'outro',   -- contrato|holerite|aso|cnd|outro
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists rh_documents_collab_idx
  on public.rh_documents (collaborator_id, created_at desc);

alter table public.rh_documents enable row level security;

drop policy if exists "gerencial gerencia documentos rh" on public.rh_documents;
create policy "gerencial gerencia documentos rh" on public.rh_documents
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
