-- 0134_finance_customization.sql
-- Personalização do Financeiro: régua de cobrança, formas de recebimento e
-- alerta de margem. Tudo na linha única de finance_settings.
--
-- Antes estavam fixos no código:
--   • régua D+3 / D+10 / D+20 com ação chumbada
--   • formas de recebimento (Pix, dinheiro, permuta…)
--   • nenhum aviso quando a margem furava a meta

alter table public.finance_settings
  -- [{ days, label, action }] — action: whatsapp | cs | email
  add column if not exists collection_rules jsonb not null default
    '[{"days":3,"label":"Lembrete amigável","action":"whatsapp"},
      {"days":10,"label":"Cobrança formal","action":"whatsapp"},
      {"days":20,"label":"Escalar para o CS","action":"cs"}]'::jsonb,

  -- [{ key, label }] — formas do recebimento manual
  add column if not exists payment_methods jsonb not null default
    '[{"key":"PIX","label":"Pix"},
      {"key":"CASH","label":"Dinheiro"},
      {"key":"TRANSFER","label":"Transferência"},
      {"key":"CARD","label":"Cartão"},
      {"key":"BARTER","label":"Permuta"},
      {"key":"OTHER","label":"Outro"}]'::jsonb,

  -- Avisa no WhatsApp interno quando a margem do mês fica abaixo da meta.
  add column if not exists alert_margin      boolean not null default false,
  -- Avisa quando o total vencido passa deste valor (0 = desligado).
  add column if not exists alert_overdue     numeric(12,2) not null default 0,
  add column if not exists alert_last_sent   date;

notify pgrst, 'reload schema';
