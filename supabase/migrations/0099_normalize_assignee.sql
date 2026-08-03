-- Normaliza o responsável de tarefas/posts para NOME (canônico).
-- Antes: alguns lugares gravavam o id do OPS_TEAM (robert/ana/...); os
-- formulários já gravavam o nome. Passa tudo para nome. Idempotente (após
-- rodar, não sobram os ids antigos).

-- delivery_tasks.assignee (valor único)
update public.delivery_tasks t
set assignee = m.name
from (values
  ('robert','Robert'), ('ana','Ana Lima'), ('gustavo','Gustavo'),
  ('mariana','Mariana'), ('lucas','Lucas')
) as m(id, name)
where t.assignee = m.id;

-- delivery_tasks.assignees (array) — remapeia cada elemento preservando a ordem
update public.delivery_tasks t
set assignees = (
  select array_agg(coalesce(m.name, u.a) order by u.ord)
  from unnest(t.assignees) with ordinality as u(a, ord)
  left join (values
    ('robert','Robert'), ('ana','Ana Lima'), ('gustavo','Gustavo'),
    ('mariana','Mariana'), ('lucas','Lucas')
  ) as m(id, name) on m.id = u.a
)
where t.assignees && array['robert','ana','gustavo','mariana','lucas'];

-- editorial_posts.assignee + assignee_secondary
update public.editorial_posts p
set assignee = m.name
from (values
  ('robert','Robert'), ('ana','Ana Lima'), ('gustavo','Gustavo'),
  ('mariana','Mariana'), ('lucas','Lucas')
) as m(id, name)
where p.assignee = m.id;

update public.editorial_posts p
set assignee_secondary = m.name
from (values
  ('robert','Robert'), ('ana','Ana Lima'), ('gustavo','Gustavo'),
  ('mariana','Mariana'), ('lucas','Lucas')
) as m(id, name)
where p.assignee_secondary = m.id;
