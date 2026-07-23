-- 0083_comercial_config.sql
-- Configurações do Comercial (Camada 3-4) — consolida o que faltava na fonte
-- única de configuração:
--   • crm_freeze_reasons  → motivos de congelamento (par do crm_lost_reasons)
--   • crm_stages          → completa o modelo da etapa (rot_days, cadence_enabled,
--                            is_handoff); probability e kind[won] já existem.

-- ── Motivos de congelamento (usados nos Arquivados) ─────────────────────────
create table if not exists public.crm_freeze_reasons (
  id         uuid primary key default gen_random_uuid(),
  label      text not null,
  position   int not null default 0,
  created_at timestamptz not null default now()
);
create unique index if not exists crm_freeze_reasons_label_idx
  on public.crm_freeze_reasons (lower(label));

insert into public.crm_freeze_reasons (label, position) values
  ('Sem budget neste trimestre', 1),
  ('Reengajar no próximo ciclo', 2),
  ('Decisor de férias / indisponível', 3),
  ('Projeto adiado pelo cliente', 4),
  ('Aguardando gatilho de mercado', 5)
on conflict do nothing;

-- ── Completa o modelo da etapa ──────────────────────────────────────────────
alter table public.crm_stages
  add column if not exists rot_days        int,                    -- dias até "apodrecer" no card
  add column if not exists cadence_enabled boolean not null default false, -- liga/desliga cadência ao entrar
  add column if not exists is_handoff      boolean not null default false; -- etapa de passagem de bastão

-- Semeia os flags coerentes com a cadeia de funis já existente.
update public.crm_stages set cadence_enabled = true  where key = 'sdr_tentativa_contato';
update public.crm_stages set is_handoff      = true  where key = 'sdr_reuniao_realizada';

-- ── RLS (gerencial) ─────────────────────────────────────────────────────────
alter table public.crm_freeze_reasons enable row level security;
drop policy if exists "gerencial gerencia crm_freeze_reasons" on public.crm_freeze_reasons;
create policy "gerencial gerencia crm_freeze_reasons" on public.crm_freeze_reasons
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

notify pgrst, 'reload schema';
