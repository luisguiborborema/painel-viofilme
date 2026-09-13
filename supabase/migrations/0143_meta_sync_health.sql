-- 0143_meta_sync_health.sql
-- Saúde da sincronização com o Meta.
--
-- O cron roda às 6h e ninguém acompanha. Uma conta com token expirado ficava
-- semanas sem números novos, e a primeira pessoa a notar era o cliente
-- perguntando por que o relatório parou de andar.
--
-- Estas colunas dão o que faltava: quando foi a última sincronização boa, qual
-- foi o último erro, e há quantas execuções seguidas o cliente está falhando —
-- que é o gatilho do aviso.

-- `last_synced_at` já existe desde a 0003 e continua sendo o carimbo do último
-- sucesso — não duplicamos.
alter table public.meta_connections
  add column if not exists last_error           text,
  add column if not exists consecutive_failures integer not null default 0,
  -- Evita repetir o mesmo aviso todo dia enquanto ninguém arruma.
  add column if not exists alerted_at           timestamptz;

comment on column public.meta_connections.consecutive_failures is
  'Execuções seguidas com erro. Zera na primeira sincronização bem-sucedida.';

notify pgrst, 'reload schema';
