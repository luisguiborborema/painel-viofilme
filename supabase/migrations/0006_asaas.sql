-- ============================================================================
-- PAINEL VIOFILME — Integração financeira Asaas (webhook → Supabase)
-- payments: pagamentos/cobranças sincronizados pelo webhook.
-- asaas_webhook_events: log/idempotência dos eventos recebidos.
-- ============================================================================

-- Mapa cliente ↔ cliente Asaas
alter table public.clients
  add column if not exists asaas_customer_id text;
create index if not exists clients_asaas_customer_idx
  on public.clients (asaas_customer_id);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  asaas_payment_id text not null unique,
  client_id uuid references public.clients (id) on delete set null,
  asaas_customer_id text,
  status text,               -- PENDING, RECEIVED, CONFIRMED, OVERDUE, REFUNDED...
  billing_type text,         -- BOLETO, PIX, CREDIT_CARD...
  value numeric(12,2),
  net_value numeric(12,2),
  due_date date,
  payment_date date,
  description text,
  invoice_url text,
  external_reference text,
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists payments_client_idx
  on public.payments (client_id, due_date desc);

create table if not exists public.asaas_webhook_events (
  event_id text primary key,
  event text,
  payment_id text,
  raw jsonb,
  received_at timestamptz not null default now()
);

-- RLS: portal lê; escrita é sempre via service_role (o webhook não tem sessão).
alter table public.payments             enable row level security;
alter table public.asaas_webhook_events enable row level security;

create policy "lê pagamentos por cliente" on public.payments
  for select using (
    public.app_role() = 'gerencial' or client_id = public.app_client_id()
  );
create policy "gerencial gerencia pagamentos" on public.payments
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

create policy "gerencial lê eventos asaas" on public.asaas_webhook_events
  for select using (public.app_role() = 'gerencial');

grant all on public.payments             to anon, authenticated, service_role;
grant all on public.asaas_webhook_events to anon, authenticated, service_role;
