-- 0066_post_dates.sql
-- Ficha do post (C3/C3.1): duas datas + data comemorativa.
--   post_date_iso    = data de POSTAGEM (vai ao ar) — a fonte, controlada pelo usuário.
--   delivery_date    = PRAZO DE ENTREGA (arte pronta) = quarta da semana ANTERIOR à postagem.
--   delivery_overridden = true quando o prazo foi escrito à mão (para de recalcular).
--   commemorative_date  = data comemorativa do mês vinculada ao post (label da LE), opcional.

alter table public.editorial_posts add column if not exists post_date_iso       date;
alter table public.editorial_posts add column if not exists delivery_date       date;
alter table public.editorial_posts add column if not exists delivery_overridden boolean not null default false;
alter table public.editorial_posts add column if not exists commemorative_date  text;
