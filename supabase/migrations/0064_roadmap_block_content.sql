-- 0064_roadmap_block_content.sql
-- VioLaunch VL04 — conteúdo editável dos 7 blocos do Roadmap (fecha o placeholder
-- "editor do Roadmap"). content jsonb guarda o texto produzido por bloco
-- (60% template do Playbook de Nicho + 40% personalizado — o texto vive aqui).

alter table public.roadmap_blocks add column if not exists content jsonb not null default '{}'::jsonb;
