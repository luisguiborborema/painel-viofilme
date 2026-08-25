-- 0129_api_logs.sql
-- Logs de chamadas à API (aba Admin → Logs de API).
--
-- Registra as chamadas aos endpoints que sistemas externos consomem: captação
-- pública, formulários, pesquisas, webhooks (Asaas/Uazapi), MCP e rotinas.
-- Guarda status, duração e o motivo do erro — sem corpo da requisição, para não
-- reter dado pessoal desnecessário.

create table if not exists public.api_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  method      text not null,
  path        text not null,
  -- Agrupador legível: "webhook:asaas", "public:lead", "mcp", "cron:daily".
  source      text not null default 'api',
  status      integer not null default 0,
  ok          boolean not null default false,
  duration_ms integer not null default 0,
  -- Identificação da origem (sem dado sensível).
  ip          text,
  user_agent  text,
  actor       text,               -- usuário logado, quando houver
  error       text,               -- mensagem curta quando falhou
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists api_logs_created_idx on public.api_logs (created_at desc);
create index if not exists api_logs_source_idx  on public.api_logs (source, created_at desc);
create index if not exists api_logs_errors_idx  on public.api_logs (created_at desc) where ok = false;

alter table public.api_logs enable row level security;

-- Leitura só pelo painel gerencial (a tela filtra Admin). A escrita é feita
-- com service-role, que ignora RLS.
drop policy if exists "gerencial le api_logs" on public.api_logs;
create policy "gerencial le api_logs" on public.api_logs
  for select using (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
