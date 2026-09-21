-- 0152_caixa_linhas_do_fluxo.sql
-- Afina a linha do fluxo das categorias que o palpite da 0151 não distinguiu.
--
-- A 0151 derivou `cash_flow_line` só do `impact_type`, e todo
-- `operating_expense` caiu em "estrutura". Com isso a FOLHA aparecia dentro de
-- "Estrutura e softwares" no Fluxo por mês — a maior saída da agência somada
-- ao aluguel e ao Google Workspace, que é exatamente a distinção que o bloco
-- existe para fazer (spec de Caixa, §2.2: "pessoal, incluindo pró-labore →
-- Equipe e pró-labore").
--
-- Só toca quem ainda está com o palpite padrão ('estrutura'): quem já escolheu
-- a linha na mão fica como está.

update public.expense_categories
   set cash_flow_line = 'equipe'
 where cash_flow_line = 'estrutura'
   and (key in ('salarios', 'comissoes', 'folha', 'prolabore', 'pro_labore', 'equipe')
        or label ilike '%salári%' or label ilike '%pró-labore%' or label ilike '%pro-labore%'
        or label ilike '%folha%' or label ilike '%comiss%');

update public.expense_categories
   set cash_flow_line = 'diretos'
 where cash_flow_line = 'estrutura'
   and (key in ('variavel', 'freelas', 'freelancers', 'producao', 'locacao')
        or label ilike '%variáve%' or label ilike '%freela%'
        or label ilike '%produção%' or label ilike '%locação%');
