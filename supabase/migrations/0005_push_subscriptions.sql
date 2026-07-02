-- ============================================================================
-- PAINEL VIOFILME — Inscrições de Web Push
-- Cada usuário pode ter várias inscrições (um device/navegador cada).
-- RLS: o usuário gerencia apenas as próprias inscrições.
-- ============================================================================
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

create policy "gerencia as próprias inscrições" on public.push_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

grant all on public.push_subscriptions to anon, authenticated, service_role;
