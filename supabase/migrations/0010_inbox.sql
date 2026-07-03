-- ============================================================================
-- PAINEL VIOFILME — Atendimento (inbox WhatsApp multi-atendente, estilo Kommo)
--
-- wa_conversations : uma conversa por número de WhatsApp (todo contato).
-- wa_messages      : mensagens (entrada/saída) de cada conversa.
--
-- Interno da agência (gerencial). Webhook de entrada grava via service_role.
-- Atendentes = profiles (role gerencial); atribuição via assigned_to.
-- ============================================================================

create table if not exists public.wa_conversations (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,                -- dígitos DDI+DDD
  name text,                                 -- pushName / nome do contato
  lead_id uuid references public.crm_leads (id) on delete set null,
  assigned_to uuid references public.profiles (id) on delete set null,
  status text not null default 'open',       -- open|pending|closed
  last_message_at timestamptz,
  last_message_preview text,
  last_direction text,                       -- in|out
  unread_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists wa_conversations_updated_idx
  on public.wa_conversations (last_message_at desc);
create index if not exists wa_conversations_assigned_idx
  on public.wa_conversations (assigned_to);

create table if not exists public.wa_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.wa_conversations (id) on delete cascade,
  direction text not null,                   -- in|out
  type text not null default 'text',         -- text|audio|image|document
  body text,
  media_url text,
  author text,                               -- nome do atendente (saída)
  external_id text,                          -- id da mensagem no provedor
  status text,                               -- sent|delivered|read
  created_at timestamptz not null default now()
);
create index if not exists wa_messages_conv_idx
  on public.wa_messages (conversation_id, created_at);
create unique index if not exists wa_messages_external_idx
  on public.wa_messages (external_id)
  where external_id is not null;

alter table public.wa_conversations enable row level security;
alter table public.wa_messages      enable row level security;

create policy "gerencial gerencia conversas" on public.wa_conversations
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

create policy "gerencial gerencia mensagens" on public.wa_messages
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.wa_conversations to anon, authenticated, service_role;
grant all on public.wa_messages      to anon, authenticated, service_role;
