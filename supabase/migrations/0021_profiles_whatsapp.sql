-- ============================================================================
-- PAINEL VIOFILME — telefone (WhatsApp) por usuário gerencial
--
-- Permite DM individual ao responsável (ex.: resumo diário de tarefas atrasadas
-- do CRM só para quem é dono). Só dígitos (DDI+DDD+número).
-- ============================================================================
alter table public.profiles
  add column if not exists whatsapp text;
