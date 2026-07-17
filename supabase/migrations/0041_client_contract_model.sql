-- 0041_client_contract_model.sql
-- Modelo de contrato do cliente: recorrente (VioDelivery) vs pontual
-- (VioProjects). Alimenta o badge na head do cliente — muda o fluxo de
-- urgência da equipe. Cadastro manual pelo gerencial.

alter table public.clients
  add column if not exists contract_model text not null default 'recorrente';
  -- valores: 'recorrente' | 'pontual'
