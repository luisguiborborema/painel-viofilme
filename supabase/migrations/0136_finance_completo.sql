-- 0136_finance_completo.sql
-- Fecha o Financeiro: rentabilidade por cliente, comprovantes e conciliação.
--
--  • client_id na despesa → dá para saber quanto cada cliente CUSTA, e com a
--    receita que já existe, qual dá lucro de verdade.
--  • attachment_url → comprovante/nota no lançamento (bucket wa-media, o mesmo
--    já usado pelos outros anexos do painel).
--  • reconciled_at → marca o que de fato caiu/saiu da conta, separando o
--    previsto do confirmado no extrato e no fluxo de caixa.

alter table public.expenses
  add column if not exists client_id      uuid references public.clients(id) on delete set null,
  add column if not exists attachment_url text,
  add column if not exists reconciled_at  timestamptz;

alter table public.payments
  add column if not exists attachment_url text,
  add column if not exists reconciled_at  timestamptz;

create index if not exists expenses_client_idx      on public.expenses (client_id);
create index if not exists expenses_reconciled_idx  on public.expenses (reconciled_at);
create index if not exists payments_reconciled_idx  on public.payments (reconciled_at);

notify pgrst, 'reload schema';
