-- Preferências de notificação por usuário.
-- `muted` guarda as categorias que o usuário NÃO quer receber (push + sininho).
-- Ausência de linha = recebe tudo (padrão fail-open).

create table if not exists public.notification_preferences (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  muted      text[] not null default '{}',
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

-- Cada usuário gerencia apenas a própria linha. O servidor lê via service_role
-- (bypass RLS) na hora de decidir para quem enviar.
drop policy if exists "notif_prefs_select_own" on public.notification_preferences;
create policy "notif_prefs_select_own" on public.notification_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "notif_prefs_insert_own" on public.notification_preferences;
create policy "notif_prefs_insert_own" on public.notification_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "notif_prefs_update_own" on public.notification_preferences;
create policy "notif_prefs_update_own" on public.notification_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
