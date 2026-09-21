-- 0148_dashboard_financeiro.sql
-- Dashboard Financeiro (spec da página 1, partes §4, §5, §6 e §13).
--
-- Três coisas que a página precisa e o banco ainda não tinha:
--
--  1) Os parâmetros de §13. Todos com padrão, porque a spec é explícita:
--     ninguém precisa configurar nada para começar. `min_cash_reserve` em 0
--     significa "só avise se o caixa for a negativo", que é o comportamento
--     certo para quem nunca abriu Configurações.
--
--  2) Duas flags na conta. `counts_as_available` separa o dinheiro que dá para
--     gastar hoje do que está em reserva ou investimento — sem isso o "Saldo
--     disponível" do Pulso soma a reserva e diz que há fôlego onde não há.
--     `requires_statement_confirmation` marca a conta cujo extrato é importado
--     à mão, que é quem liga o botão "Importar extrato" e o aviso I1.
--
--  3) O silêncio dos avisos (§5.3 regra 4), por usuário e por ESCOPO. A chave
--     é `tipo:escopo` (ex.: `I1:conta-<id>`): silenciar o extrato parado de uma
--     conta não pode calar o de outra.
--
-- Não tem tabela de alertas, e não deve ter: cada exceção é uma consulta sobre
-- o estado atual e some sozinha quando o problema acaba (§5).

/* 1) Parâmetros do Dashboard (§13) ---------------------------------------- */

alter table public.finance_settings
  -- E2 e Slide 1: piso do caixa, em reais (a tabela inteira é numeric(12,2)).
  add column if not exists min_cash_reserve     numeric(12,2) not null default 0,
  -- E5: alerta de cobrança não enviada com vencimento em até N dias.
  add column if not exists charge_lead_days     integer       not null default 5,
  -- I1 e popover de saldo: conta sem importação de extrato há mais de N dias.
  add column if not exists stale_statement_days integer       not null default 7,
  -- E8: baixa sem confirmação no extrato há mais de N dias.
  add column if not exists unconfirmed_days     integer       not null default 7,
  -- E7: acima de qualquer um dos dois, a conciliação pendente vira 🟠.
  add column if not exists reconcile_max_open   integer       not null default 20,
  add column if not exists reconcile_max_days   integer       not null default 7,
  -- I2 e Slide 4: categoria acima de N% do orçado.
  add column if not exists budget_tolerance     numeric(5,2)  not null default 110,
  -- I3: dia do mês a partir do qual o fechamento do mês anterior é cobrado.
  add column if not exists closing_due_day      integer       not null default 10;

/* 2) Flags da conta (§4 e §6.1) ------------------------------------------- */

alter table public.financial_accounts
  add column if not exists counts_as_available             boolean not null default true,
  add column if not exists requires_statement_confirmation boolean not null default false;

-- Conta de gateway (Asaas) tem liquidez D+1 e extrato próprio: continua no
-- disponível, mas nunca pede importação manual de extrato.
update public.financial_accounts
   set requires_statement_confirmation = true
 where kind = 'banco'
   and requires_statement_confirmation = false;

/* 3) Silêncio dos avisos ⚪ (§5.3 regra 4) -------------------------------- */

create table if not exists public.dashboard_silences (
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- `tipo:escopo`, do `chaveDeExcecao()` da camada de métricas.
  exception_key  text not null,
  silenced_until date not null,
  created_at     timestamptz not null default now(),
  primary key (user_id, exception_key)
);

create index if not exists dashboard_silences_until_idx
  on public.dashboard_silences (user_id, silenced_until);

alter table public.dashboard_silences enable row level security;

-- Silêncio é preferência pessoal: cada um só enxerga e mexe no próprio.
drop policy if exists "dashboard_silences_own" on public.dashboard_silences;
create policy "dashboard_silences_own" on public.dashboard_silences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

/* 4) Última visita, para a faixa "Desde ontem" (§4) ----------------------- */

-- Sem isto a faixa só sabe falar de ontem, e quem passou o fim de semana fora
-- perde de vista tudo o que aconteceu enquanto esteve ausente.
create table if not exists public.dashboard_visits (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  last_seen_at timestamptz not null default now()
);

alter table public.dashboard_visits enable row level security;

drop policy if exists "dashboard_visits_own" on public.dashboard_visits;
create policy "dashboard_visits_own" on public.dashboard_visits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
