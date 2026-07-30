-- 0089_form_sections_conditions.sql
-- Formulários/briefings: seções (agrupamento visual) + campos condicionais.
--  - Seção: um campo com field_type = 'section' (label = título; sem input).
--  - Condicional: o campo só aparece se show_if_key (chave de outro campo) tiver
--    valor igual a show_if_value. Vazio = sempre visível.

alter table public.crm_form_fields
  add column if not exists show_if_key   text,
  add column if not exists show_if_value text;

notify pgrst, 'reload schema';
