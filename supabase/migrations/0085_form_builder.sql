-- 0085_form_builder.sql
-- Formulários/briefings customizáveis: cada formulário define seus próprios
-- campos e um DESTINO — cria um negócio no Comercial (crm) OU uma tarefa no
-- Painel de Entregas (entregas). Preenchimento continua pelo link público
-- /captura/<slug> (endpoint /api/public/form usa service-role).

-- 1) Destino + parametrização por formulário (estende crm_capture_forms).
alter table public.crm_capture_forms
  add column if not exists destination text not null default 'crm',   -- 'crm' | 'entregas'
  add column if not exists pipeline_id uuid,                          -- crm: funil de destino
  add column if not exists stage_id    uuid,                          -- crm: etapa de destino (null = 1ª aberta)
  add column if not exists client_id   uuid,                          -- entregas: cliente fixo do card
  add column if not exists task_type   text,                          -- entregas: Arte|Vídeo|Copy|Tráfego
  add column if not exists description text;                          -- texto de introdução do formulário

-- 2) Campos do formulário (o "briefing"). Ordenados por position.
create table if not exists public.crm_form_fields (
  id         uuid primary key default gen_random_uuid(),
  form_id    uuid not null references public.crm_capture_forms(id) on delete cascade,
  field_key  text not null,                       -- chave estável (usada em properties/custom_fields)
  label      text not null,
  field_type text not null default 'text',        -- text|textarea|number|select|date|checkbox|url|email|phone
  options    jsonb not null default '[]'::jsonb,   -- [{value,label}] para select
  required   boolean not null default false,
  map_to     text not null default 'custom',       -- title|contact_name|contact_email|contact_phone|company|custom
  position   int not null default 0,
  active      boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists crm_form_fields_form_idx on public.crm_form_fields (form_id, position);

alter table public.crm_form_fields enable row level security;
drop policy if exists "form_fields gerencial" on public.crm_form_fields;
create policy "form_fields gerencial" on public.crm_form_fields
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
grant all on public.crm_form_fields to anon, authenticated, service_role;

-- 3) Log de envios (as respostas do briefing + o card criado).
create table if not exists public.crm_form_submissions (
  id               uuid primary key default gen_random_uuid(),
  form_id          uuid references public.crm_capture_forms(id) on delete set null,
  values           jsonb not null default '{}'::jsonb,  -- {field_key: valor}
  created_lead_id  uuid,
  created_task_id  uuid,
  created_at       timestamptz not null default now()
);
create index if not exists crm_form_submissions_form_idx on public.crm_form_submissions (form_id, created_at desc);

alter table public.crm_form_submissions enable row level security;
drop policy if exists "form_submissions gerencial" on public.crm_form_submissions;
create policy "form_submissions gerencial" on public.crm_form_submissions
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');
grant all on public.crm_form_submissions to anon, authenticated, service_role;

notify pgrst, 'reload schema';
