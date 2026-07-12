-- 0032_notifications.sql
-- Central de notificações in-app (o sininho). Uma linha por destinatário.
-- Inserção via service_role (helper no servidor); cada usuário lê/atualiza as
-- suas. Complementa os canais push + WhatsApp já existentes.

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  title      text not null,
  body       text,
  url        text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read = false;

alter table public.notifications enable row level security;

drop policy if exists "vê as próprias notificações" on public.notifications;
create policy "vê as próprias notificações" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "atualiza as próprias notificações" on public.notifications;
create policy "atualiza as próprias notificações" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Inserção fica a cargo do service_role (bypassa RLS); sem policy de insert
-- para authenticated, o app não cria notificações de terceiros pelo cliente.
grant select, insert, update, delete on public.notifications
  to anon, authenticated, service_role;
