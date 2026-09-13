-- Assinatura da proposta via ZapSign.
--
-- A coluna `external_id` já existia (0082) e guarda o token do documento na
-- ZapSign — é por ele que o webhook reconcilia. O que falta é o link de
-- assinatura, o PDF assinado e a identificação de quem assina.
--
-- `provider` diz qual mecanismo vale para cada documento. Sem ele, um
-- documento antigo (aceite na própria página, nome + IP) e um assinado na
-- ZapSign ficariam indistinguíveis na leitura — e o que dá para provar sobre
-- cada um é bem diferente.

alter table public.crm_documents
  add column if not exists provider        text not null default 'interno', -- interno|zapsign
  add column if not exists sign_url        text,
  add column if not exists signed_file_url text,
  add column if not exists signer_email    text,
  add column if not exists signer_phone    text,
  add column if not exists refused_at      timestamptz;

-- O webhook chega sem sessão e busca por este campo; sem índice é varredura
-- da tabela inteira a cada evento.
create index if not exists crm_documents_external_idx on public.crm_documents (external_id);
