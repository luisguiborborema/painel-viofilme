-- ============================================================================
-- PAINEL VIOFILME — dados de amostra para o "Restaurante Sabor do Mar"
-- Permite validar o portal lendo do Supabase antes do sync real da Meta.
-- Idempotente: pode rodar mais de uma vez sem duplicar.
-- Pré-requisito: o cliente com slug 'sabor-do-mar' já existe (seed dos usuários).
-- ============================================================================

-- 1) Métricas de conta (IG + FB) — 180 dias (popula histórico de 6 meses) ----
insert into public.account_metrics
  (client_id, platform, date, followers, reach, impressions, profile_views)
select
  c.id,
  p.platform,
  g.d::date,
  (p.base_followers + (g.d::date - (current_date - interval '180 day')::date) * p.growth)::bigint,
  (p.base_reach + (extract(day from g.d)::int % 6) * (p.base_reach / 8))::bigint,
  ((p.base_reach * 14 / 10) + (extract(day from g.d)::int % 5) * (p.base_reach / 6))::bigint,
  (p.base_reach / 30)::bigint
from public.clients c
cross join (values
  ('instagram'::public.platform, 8000, 1500, 18),
  ('facebook'::public.platform,  3200,  700,  9)
) as p(platform, base_followers, base_reach, growth)
cross join generate_series(
  current_date - interval '180 day', current_date, interval '1 day'
) as g(d)
where c.slug = 'sabor-do-mar'
on conflict (client_id, platform, date) do nothing;

-- 2) Posts publicados (mix de formatos) --------------------------------------
insert into public.content_posts
  (client_id, external_id, platform, media_type, status, caption, permalink,
   published_at, likes, comments, shares, saves, reach, impressions)
select
  c.id, x.external_id, x.platform, x.media_type, 'published', x.caption, null,
  ((current_date - x.days_ago)::timestamp + time '12:30'),
  x.likes, x.comments, x.shares, x.saves, x.reach, x.impressions
from public.clients c
cross join (values
  ('seed-post-1','instagram'::public.platform,'reel'::public.media_type,    'Bastidores do camarão na moranga 🦐',  2, 1450, 120, 60, 180, 24200, 31500),
  ('seed-post-2','instagram'::public.platform,'carousel'::public.media_type,'Novo menu de inverno ❄️',              5,  980,  75, 35, 210, 15800, 19900),
  ('seed-post-3','instagram'::public.platform,'image'::public.media_type,   'Sextou com moqueca 🔥',                8,  760,  48, 20,  90,  9800, 12100),
  ('seed-post-4','instagram'::public.platform,'reel'::public.media_type,    'Como fazemos nosso pirão',            12, 1820, 160, 95, 260, 31200, 40500),
  ('seed-post-5','instagram'::public.platform,'story'::public.media_type,   'Enquete: qual prato hoje?',            1,  120,   8,  2,   5,  4200,  4600),
  ('seed-post-6','facebook'::public.platform, 'image'::public.media_type,   'Almoço executivo de R$ 39,90',         6,  210,  18, 12,  14,  6100,  8200),
  ('seed-post-7','instagram'::public.platform,'video'::public.media_type,   'Chegou camarão fresco hoje',          15,  540,  30, 15,  40,  7600,  9100),
  ('seed-post-8','instagram'::public.platform,'carousel'::public.media_type,'5 motivos pra reservar sua mesa',     20,  690,  52, 28, 120, 11200, 14000)
) as x(external_id, platform, media_type, caption, days_ago, likes, comments, shares, saves, reach, impressions)
where c.slug = 'sabor-do-mar'
on conflict (client_id, external_id) do nothing;

-- 3) Posts agendados (aparecem em "Próximas publicações") --------------------
insert into public.content_posts
  (client_id, external_id, platform, media_type, status, caption, scheduled_at)
select
  c.id, x.external_id, x.platform, x.media_type, 'scheduled', x.caption,
  (date_trunc('day', now()) + (x.in_days || ' day')::interval + time '18:00')
from public.clients c
cross join (values
  ('seed-post-s1','instagram'::public.platform,'reel'::public.media_type, 'Teaser do prato novo da semana', 2),
  ('seed-post-s2','instagram'::public.platform,'image'::public.media_type,'Promoção de quinta-feira',       4)
) as x(external_id, platform, media_type, caption, in_days)
where c.slug = 'sabor-do-mar'
on conflict (client_id, external_id) do nothing;

-- 4) Campanhas de tráfego pago -----------------------------------------------
insert into public.campaigns
  (client_id, external_id, name, objective, platform, status, budget, spend, start_date)
select
  c.id, v.external_id, v.name, v.objective, 'instagram'::public.platform,
  'active'::public.campaign_status, v.budget, 0, current_date - 35
from public.clients c
cross join (values
  ('seed-camp-1','Lead Ads — Reservas',  'Geração de leads', 1500),
  ('seed-camp-2','Tráfego — Cardápio',   'Tráfego no site',   900)
) as v(external_id, name, objective, budget)
where c.slug = 'sabor-do-mar'
on conflict (client_id, external_id) do nothing;

-- 5) Métricas diárias das campanhas — 40 dias --------------------------------
insert into public.campaign_metrics
  (campaign_id, date, impressions, reach, clicks, spend, conversions)
select
  cam.id, g.d::date,
  (400 + (extract(day from g.d)::int % 7) * 60)::bigint,
  (300 + (extract(day from g.d)::int % 5) * 50)::bigint,
  (40  + (extract(day from g.d)::int % 6) * 8)::bigint,
  round((cam.budget / 30.0)::numeric, 2),
  (2 + (extract(day from g.d)::int % 3))::bigint
from public.campaigns cam
join public.clients c on c.id = cam.client_id
cross join generate_series(
  current_date - interval '40 day', current_date, interval '1 day'
) as g(d)
where c.slug = 'sabor-do-mar'
  and cam.external_id in ('seed-camp-1','seed-camp-2')
on conflict (campaign_id, date) do nothing;

-- 6) Atualiza o gasto acumulado de cada campanha -----------------------------
update public.campaigns cam
   set spend = sub.s
  from (
    select campaign_id, sum(spend) as s
      from public.campaign_metrics group by campaign_id
  ) sub
 where sub.campaign_id = cam.id;

-- 7) Uma reunião agendada (só insere se ainda não houver) --------------------
insert into public.meetings
  (client_id, title, starts_at, join_url, agenda, participants, next_steps)
select
  c.id, 'Alinhamento mensal de resultados',
  date_trunc('day', now()) + interval '3 day' + interval '15 hour',
  'https://meet.google.com/abc-defg-hij',
  'Revisão do mês: orgânico, campanhas e calendário de conteúdo.',
  '{"Equipe Viofilme","Restaurante Sabor do Mar"}',
  'Aprovar o calendário do próximo mês e reforçar Reels.'
from public.clients c
where c.slug = 'sabor-do-mar'
  and not exists (select 1 from public.meetings m where m.client_id = c.id);
