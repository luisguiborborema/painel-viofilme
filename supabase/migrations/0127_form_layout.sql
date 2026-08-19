-- 0127_form_layout.sql
-- Modo de exibição do formulário público: 'list' (tudo numa página) ou
-- 'steps' (uma pergunta por vez, estilo Tally).

alter table public.crm_capture_forms
  add column if not exists layout text not null default 'list';

notify pgrst, 'reload schema';
