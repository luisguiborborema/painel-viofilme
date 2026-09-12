-- 0142_api_key_write.sql
-- Permissão de ESCRITA nas chaves de API.
--
-- Coluna própria, e não mais um item em `scopes`, por um motivo específico:
-- `scopes` vazio significa "todas as áreas". Se escrita fosse um escopo, toda
-- chave já existente passaria a poder escrever no dia do deploy — sem ninguém
-- decidir isso. Permissão de escrita precisa ser dada uma a uma, explicitamente.
--
-- Padrão false: nenhuma chave nasce podendo escrever.

alter table public.api_keys
  add column if not exists can_write boolean not null default false;

comment on column public.api_keys.can_write is
  'Permite as ferramentas de escrita do MCP (criar tarefa, lançar horas, registrar interação). Nunca apagar. Padrão false.';

notify pgrst, 'reload schema';
