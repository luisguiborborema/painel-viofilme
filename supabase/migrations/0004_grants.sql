-- ============================================================================
-- PAINEL VIOFILME — GRANTs padrão do Supabase
-- Concede ao papel da API (anon/authenticated) e ao service_role acesso às
-- tabelas do schema public. O RLS (definido nas migrations 0001/0002) continua
-- sendo a camada que filtra POR LINHA — aqui é só a permissão de tabela.
-- Necessário quando o projeto não aplicou os grants automáticos (sintoma:
-- "permission denied for table ...").
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables    in schema public to anon, authenticated, service_role;
grant all on all sequences in schema public to anon, authenticated, service_role;
grant all on all routines  in schema public to anon, authenticated, service_role;

-- Garante o mesmo para objetos criados no futuro nesse schema.
alter default privileges in schema public
  grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on routines  to anon, authenticated, service_role;
