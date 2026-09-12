-- 0141_editorial_kanban.sql
-- Kanban de postagens na linha editorial.
--
-- O fluxo antigo pedia ~20 campos por post numa ficha modal. O novo card tem
-- seis, preenchidos direto na coluna. Duas consequências no schema:
--
--  1. "Extra" vira um formato válido — a coluna de pedidos fora do escopo
--     padrão precisa de onde guardar os cards.
--  2. O link de referência ganha coluna própria. Ele já cabia em `refs`
--     (jsonb de moodboard), mas ler e escrever um único link por ali, num
--     campo de texto inline, é mais código do que uma coluna.
--
-- A data de entrega passa a ser MANUAL: antes era calculada como a quarta-feira
-- da semana anterior à postagem. A cadência real é semanal e definida pelo
-- social media, não derivável da data de postagem.

alter table public.editorial_posts
  add column if not exists reference_url text;

comment on column public.editorial_posts.reference_url is
  'Link de referência visual do post — único campo opcional do card.';

comment on column public.editorial_posts.delivery_date is
  'Data em que o conteúdo precisa estar pronto. Definida à mão pelo social media (antes da 0141 era calculada a partir de post_date_iso).';

comment on column public.editorial_posts.format is
  'Feed | Reels | Stories | Carrossel | Extra. "Extra" = pedido fora do escopo contratado.';

notify pgrst, 'reload schema';
