-- 0056_client_documents.sql
-- Aba Documentos do Hub: arquivos por cliente (contrato, briefing, manual de
-- marca, relatórios…). Upload manual pelo gerencial; arquivos vão para o bucket
-- wa-media/task-files. Substitui o mock de documentos.

create table if not exists public.client_documents (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients(id) on delete cascade,
  title      text not null,
  file_name  text,
  url        text not null,
  file_type  text,
  file_size  bigint,
  kind       text not null default 'outro',  -- contrato|briefing|marca|relatorio|outro
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists client_documents_client_idx
  on public.client_documents (client_id, created_at desc);

alter table public.client_documents enable row level security;
drop policy if exists "gerencial gerencia documentos" on public.client_documents;
create policy "gerencial gerencia documentos" on public.client_documents
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
