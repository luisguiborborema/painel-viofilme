-- 0050_editorial_internal_approval.sql
-- Estados da LE (Tela 1.7): Rascunho -> Em produção -> Aprovação interna ->
-- Ativa -> Concluída. Rastro de quem montou e quem aprovou internamente
-- (olhar do head/líder antes de ir ao cliente).

alter table public.editorial_lines
  add column if not exists built_by               text,
  add column if not exists internally_approved_by text,
  add column if not exists internally_approved_at  timestamptz;

-- normaliza o default do stage para a nova taxonomia
alter table public.editorial_lines alter column stage set default 'rascunho';
