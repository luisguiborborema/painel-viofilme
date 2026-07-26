-- 0088_audit_events.sql
-- Monitoramento/auditoria (admin): registra eventos do painel gerencial e do
-- cliente — login/logout, navegação (pageview), mudanças de status, edições, etc.
-- Escreve via service-role (logEvent); a página de monitoramento (admin) lê.
-- user_id é TEXT (não FK): o histórico deve sobreviver à exclusão do usuário
-- e tolerar ids do modo demo.

create table if not exists public.audit_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     text,
  user_name   text,
  user_email  text,
  panel       text not null default 'gerencial',   -- gerencial | cliente
  action      text not null,                        -- login|logout|pageview|status_change|edit|create|move|delete|update
  area        text,                                 -- Autenticação|Tarefas|Comercial|...
  target      text,                                 -- id/nome do alvo
  detail      text,                                 -- detalhe legível
  meta        jsonb not null default '{}'::jsonb
);

create index if not exists audit_events_created_idx on public.audit_events (created_at desc);
create index if not exists audit_events_action_idx  on public.audit_events (action);
create index if not exists audit_events_user_idx    on public.audit_events (user_id);
create index if not exists audit_events_panel_idx   on public.audit_events (panel);

alter table public.audit_events enable row level security;
drop policy if exists "audit gerencial" on public.audit_events;
create policy "audit gerencial" on public.audit_events
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
grant all on public.audit_events to anon, authenticated, service_role;

notify pgrst, 'reload schema';
