-- Cobrança recorrente (Asaas): assinaturas por cliente + CPF/CNPJ do cliente.
alter table public.clients
  add column if not exists cpf_cnpj text;

create table if not exists public.asaas_subscriptions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients (id) on delete cascade,
  asaas_subscription_id text not null unique,
  value numeric(12,2),
  cycle text,           -- MONTHLY, QUARTERLY, YEARLY...
  billing_type text,    -- PIX, BOLETO, CREDIT_CARD, UNDEFINED
  status text,          -- ACTIVE, INACTIVE, EXPIRED
  next_due_date date,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists asaas_subscriptions_client_idx
  on public.asaas_subscriptions (client_id);

alter table public.asaas_subscriptions enable row level security;

create policy "gerencial gerencia assinaturas" on public.asaas_subscriptions
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant all on public.asaas_subscriptions to anon, authenticated, service_role;
