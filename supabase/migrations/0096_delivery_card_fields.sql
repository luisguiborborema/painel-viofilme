-- Campos "principais" exibidos no card do Painel de Entregas (padrão da equipe).
-- Cada usuário pode sobrescrever a própria visão no navegador.
alter table public.delivery_settings
  add column if not exists card_fields jsonb;
