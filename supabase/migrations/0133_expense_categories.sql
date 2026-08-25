-- 0133_expense_categories.sql
-- Categorias de despesa personalizáveis.
--
-- Antes eram 6 chaves fixas no código (salarios, ferramentas, comissoes,
-- impostos, variavel, outros), mapeadas 1:1 nas linhas do DRE — não dava para
-- criar "Aluguel", "Marketing" ou "Contabilidade". Agora a agência cadastra as
-- suas, e o DRE mostra uma linha por categoria com movimento.
--
-- `expenses.category` continua guardando a CHAVE (texto), então os lançamentos
-- existentes seguem válidos sem migração de dados.

create table if not exists public.expense_categories (
  id        uuid primary key default gen_random_uuid(),
  key       text not null,                       -- slug estável, referenciado em expenses.category
  label     text not null,
  -- Onde entra no DRE:
  --   deducao = abate da receita bruta (impostos) → receita líquida
  --   custo   = abate da receita líquida → lucro
  dre_group text not null default 'custo',
  color     text,
  position  integer not null default 0,
  active    boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists expense_categories_key_idx on public.expense_categories (key);

alter table public.expense_categories enable row level security;
drop policy if exists "gerencial gerencia expense_categories" on public.expense_categories;
create policy "gerencial gerencia expense_categories" on public.expense_categories
  for all using (public.app_role() = 'gerencial') with check (public.app_role() = 'gerencial');

-- Semeia as 6 que existiam, preservando as chaves para não quebrar o histórico.
insert into public.expense_categories (key, label, dre_group, position) values
  ('impostos',   'Impostos & deduções',          'deducao', 0),
  ('salarios',   'Salários & pró-labore',        'custo',   1),
  ('ferramentas','Ferramentas & infraestrutura', 'custo',   2),
  ('comissoes',  'Comissões comerciais',         'custo',   3),
  ('variavel',   'Custos variáveis',             'custo',   4),
  ('outros',     'Outros',                       'custo',   5)
on conflict (key) do nothing;

notify pgrst, 'reload schema';
