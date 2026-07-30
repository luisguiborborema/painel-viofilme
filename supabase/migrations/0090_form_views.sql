-- 0090_form_views.sql
-- Taxa de conversão dos formulários: conta as VISITAS ao link público
-- /captura/<slug>. Conversão = envios (crm_form_submissions) / visitas.

alter table public.crm_capture_forms
  add column if not exists views integer not null default 0;

-- Incremento atômico chamado pela página pública (via service-role).
create or replace function public.increment_form_views(p_slug text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.crm_capture_forms set views = views + 1 where slug = p_slug;
$$;

grant execute on function public.increment_form_views(text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
