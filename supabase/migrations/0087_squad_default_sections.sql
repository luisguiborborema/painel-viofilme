-- 0087_squad_default_sections.sql
-- Times (squads) ganham "telas padrão de visualização": um conjunto de seções
-- que serve de preset ao criar/editar um usuário daquele time.
--   null  → time sem preset definido
--   array → chaves de seção (mesmas de allowed_sections/SECTIONS)

alter table public.squads
  add column if not exists default_sections text[];

notify pgrst, 'reload schema';
