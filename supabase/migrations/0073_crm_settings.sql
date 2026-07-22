-- 0073_crm_settings.sql
-- Configurações finas do Comercial (Camada 4). Tabela chave/valor genérica.
-- Primeiro uso: atribuição automática de novos negócios (rodízio/carga/origem).

create table if not exists public.crm_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.crm_settings enable row level security;
drop policy if exists "gerencial gerencia crm_settings" on public.crm_settings;
create policy "gerencial gerencia crm_settings" on public.crm_settings
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

-- Config padrão de atribuição: por carga (menos negócios abertos).
insert into public.crm_settings (key, value)
values ('assignment', '{"mode":"carga","pool":[],"byOrigin":{}}'::jsonb)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
