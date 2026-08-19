-- 0118_nps_extra.sql
-- NPS: perguntas extras (além da nota 0–10) + armazenamento das respostas.

-- Perguntas extras configuráveis (jsonb: [{id,label,type,options}]).
alter table public.nps_config
  add column if not exists questions jsonb not null default '[]'::jsonb;

-- Respostas às perguntas extras (jsonb: [{id,label,value}]).
alter table public.nps_surveys
  add column if not exists extra jsonb;

notify pgrst, 'reload schema';
