-- 0044_client_goals_author.sql
-- Autor da última edição das metas (histórico de edição na aba Metas —
-- "Última atualização por [Nome]"). Metas ditam o ritmo da operação, então é
-- útil saber quem definiu.

alter table public.client_goals
  add column if not exists updated_by uuid references auth.users(id) on delete set null;
