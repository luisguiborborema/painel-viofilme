-- Atribuição de uma resposta de formulário a um cliente (feita na tela de
-- respostas). Vincula também o card criado (tarefa/negócio) àquele cliente.
alter table public.crm_form_submissions
  add column if not exists client_id uuid references public.clients(id) on delete set null;
