-- 0092_scheduling_native.sql
-- Agendador nativo (Calendly-like): o scheduling_link ganha slug + duração +
-- janelas de disponibilidade. Página pública /agendar/<slug> mostra os horários
-- livres e cria um evento na agenda. Links "externos" antigos (com url) seguem
-- funcionando (url passa a ser opcional).

alter table public.scheduling_links
  alter column url drop not null;

alter table public.scheduling_links
  add column if not exists slug         text,
  add column if not exists duration_min integer not null default 30,
  add column if not exists buffer_min   integer not null default 0,
  add column if not exists days_ahead   integer not null default 14,
  add column if not exists availability jsonb not null default '[]'::jsonb; -- [{day:0-6,start:"HH:MM",end:"HH:MM"}]

create unique index if not exists scheduling_links_slug_idx
  on public.scheduling_links (slug) where slug is not null;

notify pgrst, 'reload schema';
