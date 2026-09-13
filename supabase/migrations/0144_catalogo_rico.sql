-- Catálogo de serviços: ficha rica, custo/margem e montador de pacotes.
--
-- Contexto importante: a 0081 tentou criar `services` e `service_plans` com
-- `create table if not exists`, mas a 0065 já as havia criado com outro formato
-- (label/type/area, default_price). O `if not exists` virou no-op silencioso —
-- as tabelas nunca ganharam as colunas ricas, e a leitura do catálogo pedia
-- colunas inexistentes, devolvendo lista vazia desde sempre.
--
-- Aqui a tabela que existe é enriquecida no lugar. `label`, `type`, `area` e
-- `default_price` continuam sendo os campos canônicos (o onboarding de cliente
-- depende deles); o que entra é só o que faltava.

alter table public.services
  add column if not exists summary     text,                       -- resumo comercial (1 linha)
  add column if not exists description text,                       -- ficha: o que é, o que entrega, SLA
  add column if not exists properties  jsonb not null default '{}';

alter table public.service_plans
  add column if not exists cadence      text not null default 'mensal', -- mensal|trimestral|semestral|anual|unico
  add column if not exists cost         numeric(12,2) not null default 0,
  add column if not exists billing_type text not null default 'fixo',   -- fixo|midia_a_parte
  add column if not exists deliverables jsonb not null default '[]',    -- [{label, qty}]
  add column if not exists notes        text,
  add column if not exists active       boolean not null default true;

-- Pacotes: a 0081 criou estas tabelas de fato (não existiam antes), mas em
-- centavos. O resto do sistema (client_services, financeiro) trabalha em reais
-- numéricos; misturar unidade é fonte garantida de erro por fator 100.
alter table public.package_items
  add column if not exists price numeric(12,2) not null default 0,
  add column if not exists cost  numeric(12,2) not null default 0,
  add column if not exists cadence text not null default 'mensal';

update public.package_items
   set price = coalesce(price_cents, 0) / 100.0,
       cost  = coalesce(cost_cents, 0) / 100.0
 where price = 0 and cost = 0 and (price_cents is not null or cost_cents is not null);

-- Desconto em PONTOS PERCENTUAIS sobre a proposta inteira. Em reais sobre o
-- mensal, o mesmo desconto valeria coisas diferentes conforme a cadência de
-- cada item, e a margem sairia errada sem avisar.
alter table public.packages
  add column if not exists discount numeric(5,2) not null default 0;

-- A proposta gerada a partir de um pacote é um crm_documents (já tem link
-- público, rastreio de abertura e assinatura). O vínculo permite mostrar no
-- pacote se a proposta foi vista.
alter table public.crm_documents
  add column if not exists package_id uuid references public.packages(id) on delete set null;

create index if not exists crm_documents_package_idx on public.crm_documents (package_id);
create index if not exists package_items_package_idx on public.package_items (package_id);
