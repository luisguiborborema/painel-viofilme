-- 0139_api_keys.sql
-- Chaves de API do painel (hoje: acesso ao MCP).
--
-- Antes havia uma única chave, na variável MCP_TOKEN. Isso significa: não dá
-- para saber quem usou, não dá para revogar o acesso de uma pessoa sem cortar
-- o de todas, e revogar exige trocar variável de ambiente e refazer o deploy.
--
-- O TOKEN EM SI NÃO É GUARDADO. Guardamos o SHA-256 dele. Quem tem acesso ao
-- banco não consegue usar as chaves de ninguém, e o valor só aparece uma vez,
-- no momento da criação. Perdeu, gera outra — é o mesmo contrato de qualquer
-- provedor sério, e o motivo é o mesmo.

create table if not exists public.api_keys (
  id          uuid primary key default gen_random_uuid(),
  -- Para que serve esta chave: "Claude do Guilherme", "Claude do time"…
  name        text not null,
  -- SHA-256 do token, em hex. Nunca o token.
  token_hash  text not null unique,
  -- Começo do token, só para reconhecer a linha na tela (ex.: "vio_a1b2c3").
  prefix      text not null,
  scope       text not null default 'mcp',
  created_by  text,
  created_at  timestamptz not null default now(),
  -- Atualizado em uso, com folga de alguns minutos: mostra chave esquecida
  -- ativa e chave criada que nunca foi usada.
  last_used_at timestamptz,
  revoked_at   timestamptz,
  revoked_by   text
);

create index if not exists api_keys_hash_idx   on public.api_keys (token_hash) where revoked_at is null;
create index if not exists api_keys_criadas_idx on public.api_keys (created_at desc);

alter table public.api_keys enable row level security;
-- Só o service-role lê esta tabela (é ele que valida a chave no endpoint).
-- Nenhuma política para usuário comum: o painel acessa via rota de servidor.
drop policy if exists "gerencial gerencia api_keys" on public.api_keys;
create policy "gerencial gerencia api_keys" on public.api_keys
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
