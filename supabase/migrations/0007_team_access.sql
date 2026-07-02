-- ============================================================================
-- PAINEL VIOFILME — Acesso por seção (RBAC gerencial)
-- team_role: rótulo do tipo (gestor/financeiro/rh/social/trafego/cs/custom).
-- allowed_sections: seções permitidas; NULL = acesso total (Gestor).
-- Usuários gerenciais existentes ficam com NULL → continuam vendo tudo.
-- ============================================================================
alter table public.profiles
  add column if not exists team_role text,
  add column if not exists allowed_sections text[];
