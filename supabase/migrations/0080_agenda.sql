-- 0080_agenda.sql
-- Calendário/Agenda (gestora de tempo) — arquitetura universal (owner_id/squad_id),
-- pronta pra servir todas as áreas. Três camadas: reuniões (calendar_events,
-- sync Google), rotina (routine_templates/blocks) e tarefas (reaproveita tasks).

-- ── Reuniões / eventos (complementa o Google Calendar) ──────────────────────
create table if not exists public.calendar_events (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid references public.profiles(id) on delete cascade,
  squad_id       uuid references public.squads(id) on delete set null,
  title          text not null,
  type           text not null default 'meeting',   -- meeting|call|other
  start_at       timestamptz not null,
  end_at         timestamptz,
  google_event_id text,
  deal_id        uuid references public.crm_leads(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists calendar_events_owner_idx on public.calendar_events (owner_id, start_at);

-- ── Rotina: modelos + blocos ────────────────────────────────────────────────
create table if not exists public.routine_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  role_or_squad text,                 -- ex.: "sdr", "closer" (modelo por cargo)
  is_base      boolean not null default false,
  owner_id     uuid references public.profiles(id) on delete cascade,  -- null = modelo de cargo
  created_at   timestamptz not null default now()
);

create table if not exists public.routine_blocks (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid references public.routine_templates(id) on delete cascade, -- bloco de modelo
  owner_id      uuid references public.profiles(id) on delete cascade,          -- bloco pessoal (rotina do usuário)
  title         text not null,
  weekday       int not null,         -- 0=dom … 6=sáb
  start_time    text not null,        -- "HH:MM"
  end_time      text not null,        -- "HH:MM"
  color         text not null default '#2a63c9',
  activity_type text,                 -- prospeccao|followup|reuniao|admin|livre… (alimenta o gráfico)
  created_at    timestamptz not null default now()
);
create index if not exists routine_blocks_owner_idx on public.routine_blocks (owner_id);
create index if not exists routine_blocks_template_idx on public.routine_blocks (template_id);

-- ── Links de agendamento (Calendly-like — estrutura) ────────────────────────
create table if not exists public.scheduling_links (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid references public.profiles(id) on delete cascade,
  url        text not null,
  label      text not null default 'Agendar comigo',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── RLS (gerencial) ─────────────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['calendar_events','routine_templates','routine_blocks','scheduling_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "gerencial gerencia %1$s" on public.%1$s', t);
    execute format($p$create policy "gerencial gerencia %1$s" on public.%1$s
      for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial')$p$, t);
  end loop;
end $$;

-- ── Seed: modelo base de rotina do SDR ──────────────────────────────────────
insert into public.routine_templates (id, name, role_or_squad, is_base)
values ('33333333-3333-4333-8333-333333333333', 'Rotina SDR (base)', 'sdr', true)
on conflict (id) do nothing;

insert into public.routine_blocks (template_id, title, weekday, start_time, end_time, color, activity_type)
select '33333333-3333-4333-8333-333333333333', v.title, wd, v.s, v.e, v.color, v.act
from generate_series(1, 5) as wd  -- seg a sex
cross join (values
  ('Daily',              '09:00', '09:30', '#64748b', 'admin'),
  ('Prospecção',         '09:30', '11:30', '#2a63c9', 'prospeccao'),
  ('Follow-ups',         '14:00', '16:00', '#f59e0b', 'followup'),
  ('Reuniões/diagnóstico','16:00', '18:00', '#10b981', 'reuniao')
) as v(title, s, e, color, act)
where not exists (select 1 from public.routine_blocks where template_id = '33333333-3333-4333-8333-333333333333');

notify pgrst, 'reload schema';
