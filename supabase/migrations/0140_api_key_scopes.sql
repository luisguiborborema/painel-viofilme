-- 0140_api_key_scopes.sql
-- Escopo das chaves de API: escolher O QUE cada chave pode ler.
--
-- Até aqui toda chave lia tudo — inclusive DRE, inadimplência e faturamento.
-- Uma chave criada para acompanhar campanhas não precisa disso, e "não precisa"
-- é o critério certo para "não deve".
--
-- Array vazio significa ACESSO TOTAL, de propósito: é o que as chaves já
-- criadas têm, e elas continuam funcionando exatamente como antes.

alter table public.api_keys
  add column if not exists scopes text[] not null default '{}'::text[];

comment on column public.api_keys.scopes is
  'Áreas que a chave pode ler: clientes, comercial, financeiro, marketing. Vazio = todas.';

notify pgrst, 'reload schema';
