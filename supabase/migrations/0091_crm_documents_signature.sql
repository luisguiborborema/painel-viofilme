-- 0091_crm_documents_signature.sql
-- Assinatura (e-sign) de propostas/contratos: link público /proposta/<token>
-- onde o cliente vê o documento e ACEITA (nome + confirmação). Registra quem
-- assinou e o IP. public_token é único e imprevisível (uuid).

alter table public.crm_documents
  add column if not exists public_token   uuid not null default gen_random_uuid(),
  add column if not exists signed_by_name  text,
  add column if not exists signed_ip       text;

create unique index if not exists crm_documents_public_token_idx
  on public.crm_documents (public_token);

notify pgrst, 'reload schema';
