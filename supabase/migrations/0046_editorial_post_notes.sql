-- 0046_editorial_post_notes.sql
-- Campo livre "Referências & observações" da ficha do post (Tela 3):
-- links de referência, moodboard e observações soltas para a equipe.

alter table public.editorial_posts
  add column if not exists notes text;
