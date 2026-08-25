-- 0132_finance_settings.sql
-- Configuração do Financeiro (linha única, id=1).
--
-- A meta de margem estava fixa em 42% no código (vinha do mock). Agora é
-- editável na própria tela do DRE.

create table if not exists public.finance_settings (
  id           integer primary key default 1,
  meta_margin  numeric(5,2) not null default 42,   -- % de lucro desejado
  updated_at   timestamptz not null default now(),
  constraint finance_settings_single_row check (id = 1)
);

insert into public.finance_settings (id) values (1) on conflict (id) do nothing;

alter table public.finance_settings enable row level security;
drop policy if exists "gerencial gerencia finance_settings" on public.finance_settings;
create policy "gerencial gerencia finance_settings" on public.finance_settings
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
