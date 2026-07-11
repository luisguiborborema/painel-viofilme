-- 0027_crm_comments.sql
-- Comentários internos da equipe por negócio: thread (respostas), reações por
-- emoji, edição e exclusão. Separado de crm_interactions (timeline/omni-channel).

create table if not exists public.crm_comments (
  id         uuid primary key default gen_random_uuid(),
  lead_id    uuid not null references public.crm_leads(id) on delete cascade,
  parent_id  uuid references public.crm_comments(id) on delete cascade,
  author     text,
  author_id  uuid,
  body       text not null,
  -- { "👍": ["Guilherme", ...], "🎉": [...] }
  reactions  jsonb not null default '{}'::jsonb,
  edited     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists crm_comments_lead_idx   on public.crm_comments(lead_id, created_at);
create index if not exists crm_comments_parent_idx on public.crm_comments(parent_id);

alter table public.crm_comments enable row level security;

drop policy if exists "gerencial gerencia comentários" on public.crm_comments;
create policy "gerencial gerencia comentários" on public.crm_comments
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

grant select, insert, update, delete on public.crm_comments
  to anon, authenticated, service_role;
