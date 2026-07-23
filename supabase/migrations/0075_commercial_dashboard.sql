-- 0075_commercial_dashboard.sql
-- Dashboard Comercial (Camada 2): lente operacional por função + recepção.
--   • profiles.commercial_role: sdr | closer | gestor (define a lente padrão e
--     se o toggle Pré-venda/Venda aparece). Default gestor (vê as duas).
--   • commercial_board: mural do time (recado editável pela liderança).
--   • inspiration_quotes: frases inspiracionais (rotação diária).

alter table public.profiles
  add column if not exists commercial_role text not null default 'gestor';

-- ── Mural do time ───────────────────────────────────────────────────────────
create table if not exists public.commercial_board (
  id         int primary key default 1,
  message    text not null default '',
  author     text,
  updated_at timestamptz not null default now(),
  constraint commercial_board_single check (id = 1)
);
insert into public.commercial_board (id, message)
values (1, 'Bem-vindos! Bora fazer um mês histórico. 🚀')
on conflict (id) do nothing;

alter table public.commercial_board enable row level security;
drop policy if exists "gerencial gerencia mural" on public.commercial_board;
create policy "gerencial gerencia mural" on public.commercial_board
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

-- ── Frases inspiracionais ───────────────────────────────────────────────────
create table if not exists public.inspiration_quotes (
  id     uuid primary key default gen_random_uuid(),
  text   text not null,
  source text,
  active boolean not null default true
);

alter table public.inspiration_quotes enable row level security;
drop policy if exists "gerencial le frases" on public.inspiration_quotes;
create policy "gerencial le frases" on public.inspiration_quotes
  for all using (public.app_role() = 'gerencial')
  with check (public.app_role() = 'gerencial');

insert into public.inspiration_quotes (text, source)
select * from (values
  ('O sucesso é a soma de pequenos esforços repetidos dia após dia.', 'Robert Collier'),
  ('Não conte os dias, faça os dias contarem.', 'Muhammad Ali'),
  ('A sorte é o encontro da preparação com a oportunidade.', 'Sêneca'),
  ('Vender é ajudar alguém a resolver um problema.', 'Zig Ziglar'),
  ('O melhor momento para plantar uma árvore foi há 20 anos. O segundo melhor é agora.', 'Provérbio'),
  ('Disciplina é fazer o que precisa ser feito, mesmo sem vontade.', 'Anônimo'),
  ('Cada não te aproxima do próximo sim.', 'Anônimo'),
  ('Foco não é dizer sim ao certo, é dizer não a mil coisas.', 'Steve Jobs'),
  ('A persistência realiza o impossível.', 'Provérbio chinês'),
  ('Grandes resultados exigem grandes ambições.', 'Heráclito'),
  ('Quem não mede, não melhora.', 'Peter Drucker'),
  ('Feito é melhor que perfeito.', 'Sheryl Sandberg')
) as v(text, source)
where not exists (select 1 from public.inspiration_quotes);

notify pgrst, 'reload schema';
