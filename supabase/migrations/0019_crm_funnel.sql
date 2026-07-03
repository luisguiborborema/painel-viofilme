-- ============================================================================
-- PAINEL VIOFILME — CRM: motivos de perda + histórico de estágio (funil)
--
-- crm_lost_reasons  : lista configurável de motivos de perda (dropdown na perda).
-- crm_stage_history : log de cada mudança de estágio (para análise do funil:
--                     conversão entre estágios e tempo em cada um, ao acumular).
-- ============================================================================

create table if not exists public.crm_lost_reasons (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_lost_reasons_label_idx
  on public.crm_lost_reasons (lower(label));

insert into public.crm_lost_reasons (label, position) values
  ('Preço acima do orçamento', 1),
  ('Sem budget no momento', 2),
  ('Escolheu concorrente', 3),
  ('Sem resposta / sumiu', 4),
  ('Timing ruim', 5),
  ('Não era fit', 6)
on conflict do nothing;

create table if not exists public.crm_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.crm_leads (id) on delete cascade,
  from_stage text,
  to_stage text not null,
  changed_by text,
  changed_at timestamptz not null default now()
);
create index if not exists crm_stage_history_deal_idx
  on public.crm_stage_history (deal_id, changed_at);
create index if not exists crm_stage_history_to_idx
  on public.crm_stage_history (to_stage, changed_at);

-- RLS + grants
alter table public.crm_lost_reasons  enable row level security;
alter table public.crm_stage_history enable row level security;

do $$
declare t text;
begin
  foreach t in array array['crm_lost_reasons','crm_stage_history'] loop
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format($f$
      create policy "gerencial gerencia %1$s" on public.%1$s
        for all using (public.app_role() = 'gerencial')
        with check (public.app_role() = 'gerencial')
    $f$, t);
    execute format('grant all on public.%1$s to anon, authenticated, service_role', t);
  end loop;
end $$;
