-- 0086_user_profiles.sql
-- Perfil de usuário (tier) na área de Usuários: admin | gestor | colaborador | viewer.
--  - admin       → acesso total + gerencia usuários
--  - gestor      → acesso total (todas as abas), sem gerenciar usuários
--  - colaborador → acesso às abas escolhidas (allowed_sections)
--  - viewer      → somente leitura das abas escolhidas
-- WhatsApp (0021) e Times/squads (0058) já existem — aqui só o tier.

alter table public.profiles
  add column if not exists profile_tier text not null default 'colaborador';

-- Backfill dos usuários gerenciais existentes:
--  - acesso total (allowed_sections null) → admin (mantém quem já geria tudo).
--  - demais → colaborador.
update public.profiles
   set profile_tier = 'admin'
 where role = 'gerencial' and allowed_sections is null;

update public.profiles
   set profile_tier = 'colaborador'
 where role = 'gerencial' and allowed_sections is not null;

notify pgrst, 'reload schema';
