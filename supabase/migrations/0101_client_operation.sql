-- Operação editável do cliente: responsáveis por função + serviços.
-- (Entregáveis do mês já têm tabela própria: client_deliverables.)
alter table public.clients
  add column if not exists responsibles jsonb not null default '{}'::jsonb, -- {social,performance,designer,copy}
  add column if not exists services_list text[] not null default '{}';

-- ── Seed: briefings de Social Media e Performance (aparecem em "Enviar formulário")
-- Idempotente por slug. Destino = Entregas (cria tarefa/briefing).
insert into public.crm_capture_forms (name, slug, source, active, destination, task_type, description)
select 'Briefing Social Media', 'briefing-social-media', 'Briefing SM', true, 'entregas', 'Arte',
       'Contexto do mês para a produção de conteúdo de Social Media.'
where not exists (select 1 from public.crm_capture_forms where slug = 'briefing-social-media');

insert into public.crm_capture_forms (name, slug, source, active, destination, task_type, description)
select 'Briefing Performance', 'briefing-performance', 'Briefing Performance', true, 'entregas', 'Tráfego',
       'Contexto para as campanhas de tráfego pago do mês.'
where not exists (select 1 from public.crm_capture_forms where slug = 'briefing-performance');

-- Campos do Briefing Social Media
insert into public.crm_form_fields (form_id, field_key, label, field_type, required, map_to, position)
select f.id, v.field_key, v.label, v.field_type, v.required, 'custom', v.position
from public.crm_capture_forms f
cross join (values
  ('objetivo_mes',   'Qual o objetivo principal do mês?',                'textarea', true,  0),
  ('temas',          'Temas / campanhas / lançamentos do mês',           'textarea', false, 1),
  ('datas',          'Datas importantes (promoções, eventos, feriados)', 'textarea', false, 2),
  ('referencias',    'Referências / links de inspiração',                'textarea', false, 3),
  ('observacoes_sm', 'Observações para a equipe',                        'textarea', false, 4)
) as v(field_key, label, field_type, required, position)
where f.slug = 'briefing-social-media'
  and not exists (select 1 from public.crm_form_fields ff where ff.form_id = f.id and ff.field_key = v.field_key);

-- Campos do Briefing Performance
insert into public.crm_form_fields (form_id, field_key, label, field_type, required, map_to, position)
select f.id, v.field_key, v.label, v.field_type, v.required, 'custom', v.position
from public.crm_capture_forms f
cross join (values
  ('objetivo_camp', 'Objetivo da campanha (leads, vendas, alcance…)',  'textarea', true,  0),
  ('verba',         'Verba disponível para o período',                 'text',     false, 1),
  ('publico',       'Público-alvo / segmentações',                     'textarea', false, 2),
  ('oferta',        'Oferta / produto em destaque',                    'textarea', false, 3),
  ('criativos',     'Criativos já disponíveis (links)',                'textarea', false, 4),
  ('observacoes_pf','Observações para o gestor de tráfego',            'textarea', false, 5)
) as v(field_key, label, field_type, required, position)
where f.slug = 'briefing-performance'
  and not exists (select 1 from public.crm_form_fields ff where ff.form_id = f.id and ff.field_key = v.field_key);
