-- 0048_delivery_performance.sql
-- Criativos de Performance (HUB10): o criativo é o mesmo objeto task, com
-- origin = 'Performance'. Campos específicos do briefing de tráfego:
-- objetivo de campanha e formato do criativo.

alter table public.delivery_tasks
  add column if not exists campaign_goal  text,   -- conversao | trafego | alcance | reconhecimento
  add column if not exists content_format text;   -- Reels | Feed | Stories | Carrossel
