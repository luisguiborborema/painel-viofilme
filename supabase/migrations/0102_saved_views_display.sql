-- 0102_saved_views_display.sql
-- Visões salvas (Listas › Pessoas/Empresas) passam a lembrar o estado de
-- EXIBIÇÃO — colunas ocultas + ordenação — além das condições e da lente.
-- Estilo HubSpot: cada visão restaura suas colunas/ordenação ao ser aberta,
-- e o estado viaja junto quando a visão é compartilhada com o time.
--
-- Idempotente e retrocompatível: o app já grava/lê `display` de forma tolerante
-- (funciona antes e depois desta migração). Rodar quando puder.

alter table public.saved_views
  add column if not exists display jsonb not null default '{}';
