-- 0078_stage_hint.sql
-- Hint por etapa: texto curto do que acontece na coluna (exibido no cabeçalho
-- do Kanban e editável em Configurações › Pipelines & estágios).

alter table public.crm_stages add column if not exists hint text;

-- Semeia os hints dos 2 funis iniciais (só onde ainda estiver vazio).
update public.crm_stages s set hint = v.hint
from (values
  ('sdr_contactar_urgente', 'Reservatório — zerar diariamente'),
  ('sdr_tentativa_contato',  'Cadência ON (por origem)'),
  ('sdr_contactado',         'Cadência OFF — follow-up manual'),
  ('sdr_reuniao_agendada',   'Call marcada — marca no-show'),
  ('sdr_reuniao_realizada',  'Passa o bastão p/ Vendas'),
  ('vnd_analise',            'Reunião de diagnóstico'),
  ('vnd_proposta',           'Monta estratégia e forecast'),
  ('vnd_reuniao_proposta',   'Proposta formalizada (anexa PDF)'),
  ('vnd_negociacao',         'Pós-apresentação'),
  ('ganho',                  'Dispara automações de fechamento')
) as v(key, hint)
where s.key = v.key and (s.hint is null or s.hint = '');

notify pgrst, 'reload schema';
