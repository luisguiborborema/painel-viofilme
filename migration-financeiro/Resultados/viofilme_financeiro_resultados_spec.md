# Viofilme ERP — Financeiro
## Página 5: Resultados

**Versão:** 1.0 · setembro/2026
**Público:** desenvolvimento (Gui)
**Documento-mãe:** `viofilme_financeiro_regras_gerais.md`. As seções 10 (tipos de impacto), 11 (DRE), 15 (rateio e rentabilidade) e 16 (métricas) são a base desta página. Em caso de conflito, o documento-mãe prevalece.
**Specs relacionadas:**
- Recebimentos: `recurrence_versions` e motivos de encerramento, que alimentam o MRR.
- Pagamentos › Folha: custo de equipe, capacidade e alocação.
- Caixa: variação do disponível, usada na ponte do resultado ao caixa.
**Mockup de referência:** https://claude.ai/artifact/2JZJJ4E62RzoamNYPc45Sm. Os dados são fictícios; DRE, rentabilidade e receita são calculadas da mesma base e fecham entre si.

---

## Sumário

1. Objetivo
2. Princípios da página
3. Estrutura e controles globais
4. Faixa de indicadores
5. Aba DRE
6. Aba Rentabilidade
7. Aba Receita
8. Drawers e fichas
9. Regras de cálculo
10. Validações (invariantes)
11. Automações
12. Integrações e funcionamento independente
13. Ajustes no modelo de dados (incluir no documento-mãe)
14. Parâmetros configuráveis
15. Permissões e auditoria
16. Casos de borda
17. Fora do escopo desta versão

---

## 1. Objetivo

Resultados responde **"onde estamos ganhando ou perdendo dinheiro?"**. É a página mais analítica do módulo e a principal para os sócios.

**Tudo aqui é por competência:**
- receita = o que foi vendido no período;
- custo = o que foi consumido no período.

O Caixa mostra o dinheiro; Resultados mostra o desempenho.

| Aba | Pergunta | Base |
|---|---|---|
| **DRE** | A empresa está dando lucro? O que mudou? | `document_items` por `competence_month`, agrupados pelo `impact_type` da categoria |
| **Rentabilidade** | Quais clientes, serviços, projetos e squads dão dinheiro? | Margem de contribuição (documento-mãe, seção 15) |
| **Receita** | A receita está crescendo, de onde vem e quão concentrada está? | `recurrence_versions`, títulos de receita, MRR |

---

## 2. Princípios da página

- **Número sempre explicável:** todo valor abre os lançamentos que o formam, até a ficha universal.
- **Variação explicada pelo sistema:** "o que mudou" é calculado, não fica para o usuário descobrir.
- **Números que fecham entre si:** a rentabilidade fecha com a DRE e a ponte do caixa fecha com o Caixa. Se não fecham, a página avisa e mostra a causa.
- **Análise do modelo, não de pessoas:** custo de equipe aparece por função; squads nunca mostram valores individuais.
- **Diagnóstico que vira decisão:** simulador de preço, esforço vs. contrato e ocupação por função.

---

## 3. Estrutura e controles globais

```
Cabeçalho: "Resultados" + subtítulo                         [Exportar relatório do mês]
Controles: [Mês | Trimestre]  ‹ Agosto 2026 ›  Comparar com [▾]  (selo do período)
Faixa de indicadores (4)
Abas: DRE · Rentabilidade · Receita
```

### 3.1 Período

- **Granularidade:** Mês · Trimestre (evolução futura: Ano, Últimos 12 meses, Personalizado).
- **Navegação:** ‹ ›.
- **Período padrão ao abrir: o último mês fechado.** Se não houver mês fechado, o mês corrente.
  - **Por quê:** o mês corrente está incompleto e induz a conclusões erradas.
- **Persistência:** a granularidade é persistida por usuário; o período não (sempre abre no padrão).

### 3.2 Comparar com

| Opção | Base da comparação |
|---|---|
| Período anterior (padrão) | Mês ou trimestre imediatamente anterior |
| Mesmo período do ano anterior | Mesmo mês ou trimestre, ano − 1 |
| Orçado | `budgets` do Planejamento (se não houver orçamento, a opção fica desabilitada com o tooltip "Sem orçamento para o período") |

A comparação afeta os deltas dos indicadores, as colunas da DRE e o bloco "O que explica a variação".

### 3.3 Selo do período

| Estado | Texto | Cor |
|---|---|---|
| Fechado, sem ajustes | "Fechado" | Verde |
| Fechado, com ajustes posteriores | "Fechado, N ajustes após o fechamento" | Âmbar |
| Em aberto | "Em aberto, X% realizado" | Âmbar |
| Trimestre com algum mês aberto | "Em aberto, X% realizado" | Âmbar |

- **X% realizado** = receita bruta de itens com parcela liquidada ÷ receita bruta total da competência.
- **Clique no selo com ajustes:** popover com cada ajuste (linha da DRE, valor, descrição, quem, quando). Fonte: `period_adjustments` (seção 13).
- **Linhas da DRE afetadas por ajuste** mostram um ponto âmbar com tooltip.

### 3.4 Exportar relatório do mês

Gera um **PDF de uma página**, para quem não entra no sistema:
- indicadores com deltas;
- DRE resumida (linhas principais);
- "Para cada R$ 100";
- os 5 clientes mais e os 5 menos rentáveis;
- ponte do MRR;
- selo do período.

Evolução futura: envio automático aos sócios no fechamento.

---

## 4. Faixa de indicadores

Quatro cartões, iguais em todas as abas.

| Cartão | Número | Contexto |
|---|---|---|
| Receita líquida | Valor | Δ% vs. comparação |
| Margem bruta | % | Δ em pontos percentuais + valor |
| Resultado operacional | Valor | Δ% + "margem de X%" |
| Resultado líquido | Valor | Δ% vs. comparação |

**Cores:** verde se melhora, vermelho se piora, cinza se a variação é irrelevante (< R$ 1). Para linhas de custo, **aumento é vermelho** (mesma regra do `invertDelta` do Portal).

---

## 5. Aba DRE

### 5.1 "Para cada R$ 100 de receita"

Cartão no topo, com uma **barra horizontal empilhada** que divide R$ 100 de receita bruta:

| Segmento | Composição |
|---|---|
| Impostos | Deduções |
| Equipe de entrega | Custo de pessoal do centro de custo Entrega (inclui ociosidade) |
| Custos diretos | Freelancers, locação, produção, materiais |
| Pró-labore, comercial e administrativo | Pessoal fora da entrega + encargos |
| Estrutura e softwares | Aluguel, energia, internet, seguro, contabilidade, softwares, transporte |
| Financeiro | Resultado financeiro, quando negativo |
| **Resultado** | Diferença (cor de destaque) |

- Segmentos com ≥ 6% mostram "R$ X" dentro da barra.
- Legenda abaixo com rótulo e valor de cada segmento.
- Subtítulo: "Receita bruta de R$ X em {período}".
- **Resultado negativo:** o segmento "Resultado" some e aparece "Prejuízo de R$ X a cada R$ 100" em vermelho.

### 5.2 Tabela da DRE

Estrutura conforme o documento-mãe, seção 11:

```
Receita bruta                    ▸ Mensalidades (recorrente) · Projetos e pontuais
(−) Deduções                     ▸ DAS (Simples Nacional)
= Receita líquida
(−) Custos diretos               ▸ Equipe de entrega · Freelancers e adicionais · Locação de equipamento · Produção de áudio · Materiais e impressão
= Margem bruta
(−) Despesas operacionais        ▸ Pró-labore · Encargos sobre pró-labore · Equipe administrativa · Comercial (fixo e comissões) · Estrutura · Contabilidade · Softwares · Transporte e alimentação
= Resultado operacional
(±) Resultado financeiro         ▸ Juros e multas recebidos · Tarifas e taxas · Rendimentos
= Resultado líquido
```

- **As subcategorias vêm do plano de categorias** (grupo › categoria), não são fixas no código.
- Linhas de grupo são **recolhíveis** (chevron). Estado padrão: Custos diretos aberto, os demais fechados. O estado é persistido por usuário.
- Linhas de total ("= ...") em negrito com fundo destacado; Resultado líquido mais forte.
- Custos exibidos com "−". Valores formatados sem "R$", zero como "—".
- **Primeira coluna fixa** e rolagem horizontal quando necessário.

**Modos** (segmento no cabeçalho do cartão):

| Modo | Colunas |
|---|---|
| **Período** (mês fechado ou trimestre) | Valor · % RL · Comparação · Δ · Δ% |
| **Período** (mês em aberto) | **Realizado · Previsto · Total** · % RL · Comparação · Δ |
| **Evolução mensal** | 12 meses (96px cada), com o valor e, abaixo, o % da receita líquida em cinza |

- **Realizado** = itens cuja parcela está liquidada. **Previsto** = itens com parcela aberta e competência no período.
- **Cor do Δ:** verde se melhora o resultado, vermelho se piora (para custos, aumento é vermelho).
- **Clique em valor de categoria** (qualquer coluna de valor): abre o **drawer de lançamentos** (8.1) daquela categoria no período (no modo Evolução, no mês da coluna). Linhas de grupo e totais não são clicáveis.

### 5.3 "O que explica a variação"

Cartão ao lado da tabela (330px).

- **Cabeçalho:** "Resultado líquido vs. {comparação}" + Δ total (verde ou vermelho).
- **Itens:** as **5 categorias com maior impacto absoluto** no resultado. Impacto = (atual − comparação) × sinal (receitas +, custos −).
  - Cada item mostra ▲/▼, nome da categoria e o impacto em R$.
  - Mostra também uma **nota automática** com os lançamentos que explicam a diferença: os maiores itens que existem num período e não no outro, ou que mudaram mais de 20%. Exemplos: "Verde Vale entrou; APTO e Mar Azul expandiram", "118% do orçado: Frame.io e Envato novos no cartão".
- **"Demais linhas":** soma do impacto das outras categorias.
- **Clique no item:** abre o drawer de lançamentos da categoria.

**Geração da nota:**
- regra determinística, sem IA na v1;
- para receitas recorrentes, usa os movimentos de MRR do período (novos, expansões, pausas, churn);
- para as demais, lista até 3 lançamentos com maior contribuição à diferença (contraparte + descrição curta);
- para categorias com orçamento, acrescenta o % do orçado quando acima da tolerância.

### 5.4 Fora da DRE

Cartão abaixo da variação, com duas linhas:
- **Investimentos do período** (`investment`);
- **Sócios e financiamento** (`equity_financing`).

Texto fixo: "Movimentam o caixa, mas não são receita nem despesa da operação."

### 5.5 Do resultado ao caixa

É uma **cascata** (gráfico de ponte), largura total:

```
Resultado líquido
  (−/+) Variação de recebíveis        (vendido no período e ainda não recebido, menos recebido de períodos anteriores)
  (+/−) Variação de contas a pagar    (consumido e ainda não pago, menos pago de períodos anteriores)
  (−) Investimentos
  (−/+) Distribuição de lucros e aportes
  (−/+) Aplicações e resgates da reserva
= Variação do caixa disponível
```

- **Barras:** início e fim em cor cheia (fim verde ou vermelho pelo sinal); deltas verdes (positivos) ou vermelhos (negativos). Valor acima de cada barra ("−6,3 mil"), rótulo abaixo.
- **Itens com valor zero são omitidos.**
- **Indicador:** "✓ Confere com a variação do disponível no Caixa". Se não conferir, aparece "⚠ Diferença de R$ X com o Caixa", com link para a análise (seção 10).
- **Clique numa barra:** drawer com os títulos ou movimentações que compõem o item.

**Cálculo:**
- Recebíveis = Σ saldo de parcelas `in` no fim do período − no início (só operacionais).
- Contas a pagar = Σ saldo de parcelas `out` no fim − no início.
- Demais itens = Σ movimentações dos grupos `investing`, `financing` e `internal` no período.

---

## 6. Aba Rentabilidade

### 6.1 Seletor de dimensão

Segmento **Clientes · Serviços · Projetos · Squads**. É a mesma atividade em dimensões diferentes, por isso não são abas.

Link **"Como é calculado"** que expande um painel com a fórmula, a regra das vagas e o exemplo.

### 6.2 Prova de fechamento (sempre visível)

```
Margem de contribuição − Capacidade ociosa − Operação geral − Estrutura ± Financeiro = Resultado líquido    [✓ Confere com a DRE]
```

- Os valores do período, com os operadores entre eles, e o resultado na cor de destaque.
- **✓ Confere com a DRE** (verde) quando a soma bate com o resultado líquido da DRE (tolerância R$ 1).
- **Quando não confere:** ⚠ vermelho + lista de causas prováveis (seção 10.1), cada uma com link para corrigir.

### 6.3 Alertas da rentabilidade

Faixas âmbar abaixo da prova, uma por ocorrência no período:
- **Função acima da capacidade:** "{Função} acima da capacidade em {mês}: X vagas usadas de Y. O custo por vaga cai, mas a equipe está sobrecarregada." → "Ver alocação".
- **Colaborador de entrega sem alocação:** "{N} colaboradores de entrega sem alocação em {mês}: R$ X não distribuídos." → "Alocar".
- **Custos diretos sem cliente acima de 5% dos custos diretos:** → "Ver lançamentos".

### 6.4 Clientes

**Matriz de rentabilidade** (gráfico de dispersão):
- **Eixo X:** receita do cliente no período. **Eixo Y:** margem de contribuição %. **Tamanho do ponto:** vagas de equipe consumidas (média do período). **Cor:** saúde.
- **Linhas de referência tracejadas:** receita média por cliente (vertical) e margem média da carteira (horizontal). Linha vermelha suave em 0%.
- **Rótulos dos quadrantes:**
  - superior direito: **Pilares**;
  - superior esquerdo: **Eficientes**;
  - inferior direito: **Rever escopo ou preço** (âmbar);
  - inferior esquerdo: **Atenção** (vermelho).
- Nomes visíveis só para os 4 maiores em receita e para os clientes com saúde "Crítica" (evita poluição).
- **Hover:** tooltip com nome, receita, margem (R$ e %) e vagas. **Clique:** ficha de rentabilidade do cliente (8.2).

**Tabela:**

| Coluna | Conteúdo |
|---|---|
| Cliente | Nome + serviços |
| Receita | Recorrente + pontual do período |
| Deduções | Alíquota efetiva × receita |
| Equipe | Σ (vagas × custo por vaga) |
| Custos diretos | Itens de custo direto com o cliente |
| Margem | R$ |
| Margem % | Sobre a receita líquida do cliente |
| Vagas | Média de vagas no período |
| Tendência | Mini gráfico da margem % nos últimos 6 meses |
| Saúde | Saudável · Atenção · Crítica |

- **Ordenação padrão: margem % crescente** (pior primeiro); as colunas são ordenáveis.
- **Rodapé:**
  - **Carteira** (totais e margem média);
  - **Operação geral** (custos diretos sem cliente, "Sem cliente");
  - **Capacidade ociosa** (âmbar, "Vagas livres").
- **Clique na linha:** ficha do cliente.

**Saúde (limites configuráveis):**

| Selo | Padrão |
|---|---|
| Saudável | Margem ≥ 55% |
| Atenção | 40% a 55% |
| Crítica | < 40% ou negativa |

> Os limites padrão refletem a **margem de contribuição**, que não inclui estrutura. Por isso são mais altos que uma margem líquida. Ajustar em Configurações após os primeiros meses de uso real.

O selo (sem números) é o que o CS vê (documento-mãe, seção 21).

### 6.5 Serviços

- **Barras horizontais por serviço:** barra empilhada com a receita recorrente (cor de destaque) e pontual (azul-claro), receita total e margem % colorida pela saúde. Clique abre a ficha do serviço (evolução em 12 meses, clientes com maior e menor contribuição, custo por função).
- **Tabela:** serviço · receita · % do total · equipe · custos diretos · margem · margem % · clientes.
- **Nota fixa:** "Equipe por serviço: Social Media, Tráfego e Audiovisual vêm direto das vagas da função. Design e relacionamento são divididos pela composição de serviços de cada cliente."

**Regras de distribuição por serviço:**

| Elemento | Regra |
|---|---|
| Receita recorrente | Pelos itens da recorrência (cada item tem serviço) |
| Receita pontual | Pelo serviço do item do título |
| Equipe de função com serviço próprio | Serviço da função (`primary_service_id` do colaborador ou `team_allocations.service_id`) |
| Equipe de função compartilhada (design, CS) | Proporcional à composição de receita por serviço do cliente no mês |
| Custos diretos | Serviço do item do título; se ausente, serviço do pontual do cliente no mês; senão, o principal do cliente |

### 6.6 Projetos

**Tabela:**

| Coluna | Conteúdo |
|---|---|
| Projeto | Nome + cliente |
| Status | Em andamento (azul) · Concluído (verde) |
| Contratado | `projects.contract_value` |
| Receita no período | Itens de receita do projeto com competência no período |
| Custos + equipe | Custos diretos do projeto no período + vagas alocadas ao projeto × custo por vaga |
| Margem · Margem % | Sobre a receita líquida do período ("—" se não há receita no período) |
| **Custo acumulado vs. orçado** | "R$ X de R$ Y" + barra: verde até 85%, âmbar de 85% a 100%, **vermelho acima (", estourou")** |

- O **custo acumulado** considera toda a vida do projeto (não só o período) e é comparado a `projects.budget_cost`.
- O alerta de estouro aparece **durante** o projeto, não só na conclusão.
- **Nota fixa:** "Custo orçado é informado na criação do projeto. A barra fica vermelha quando os custos acumulados passam do orçado, mesmo com o projeto em andamento."
- **Clique:** ficha do projeto (linha do tempo de receitas e custos, parcelas, custos por categoria, orçado vs. realizado, margem prevista na conclusão).

### 6.7 Squads

- **Faixa fixa:** "Análise do modelo operacional. Nenhum valor individual é exibido."
- **Cartão por squad:**
  - nome;
  - "N clientes, composição";
  - receita da carteira, equipe e custos diretos, margem (R$ e %);
  - **ocupação de social media** (vagas usadas ÷ capacidade da pessoa de social media do squad), em barra: verde < 90%, âmbar 90–100%, vermelho > 100%;
  - texto: "X de Y vagas. Espaço para N clientes" ou "Sobrecarregado: redistribuir clientes".
- **Ocupação por função** (sem nomes): uma linha por função com barra, "X de Y vagas (Z%)" e estado ("Acima da capacidade", "No limite" ≥ 95%, "Espaço para N vagas"). Base: o último mês do período.

**Regra:** o cliente pertence a um squad (`clients.squad_id`); funções compartilhadas (tráfego, design, audiovisual, CS) entram no custo do squad pelas vagas dos clientes daquele squad.

---

## 7. Aba Receita

### 7.1 Indicadores (6 cartões)

| Cartão | Definição |
|---|---|
| MRR | MRR no fim do período + variação no período |
| Receita do período | Receita bruta + "% recorrente" |
| Ticket médio | MRR ÷ clientes com recorrência ativa |
| Churn de MRR | MRR perdido por churn no período ÷ MRR no início; vermelho acima de 2% ao mês |
| Concentração top 3 | Receita dos 3 maiores ÷ receita total do período |
| Clientes ativos | Com recorrência ativa no fim do período |

### 7.2 Ponte do MRR

É uma cascata: **Início → Novos → Expansão → Contração → Churn → Pausas → Fim**.
- Novos e expansão em verde; contração e churn em vermelho; **pausas em cinza** (não são churn).
- Subtítulo: "De R$ X para R$ Y em {período}".

**Classificação dos movimentos**, a partir de `recurrence_versions` e das mudanças de status, pela data de vigência:

| Tipo | Regra |
|---|---|
| **Novo** | Recorrência ativada, de cliente sem MRR nos 90 dias anteriores |
| **Reativação** | Recorrência ativada, de cliente que teve MRR antes (exibida junto de Novos, com o selo próprio) |
| **Expansão** | Nova versão com valor maior |
| **Contração** | Nova versão com valor menor |
| **Churn** | Recorrência encerrada (motivo obrigatório vindo de Recebimentos) |
| **Pausa** | Recorrência pausada. Sai do MRR; ao retomar, entra como "Retomada" (junto de Expansão) |

### 7.3 Movimentos do período

Lista ao lado da ponte: selo do tipo (cor do tipo) · cliente · **motivo** (da versão ou do encerramento) · valor. Clique abre a ficha da recorrência com o histórico de versões.

### 7.4 Evolução em 12 meses

- Barras empilhadas por mês e **linha do MRR** (fim do mês) sobreposta.
- **Segmento:** "Recorrente e pontual" | "Por serviço" (uma cor por serviço).
- Meses do período selecionado destacados (fundo e rótulo mais fortes).
- Tooltip por mês: receita e MRR.

### 7.5 Concentração

- Top 8 clientes por receita no período: barra proporcional, % da receita e **% acumulado**.
- **Alerta** quando um cliente passa do limite (padrão 15%): barra em vermelho e a nota "{Cliente} passa de 15% da receita. Perdê-lo reduziria a margem em R$ X", com a margem de contribuição do cliente.
- Sem alerta: "Nenhum cliente acima de 15%. O maior é {cliente}, com X%."

### 7.6 Receita por serviço

Tabela: serviço · recorrente · pontual · total · % · Δ vs. comparação.

---

## 8. Drawers e fichas

### 8.1 Drawer de lançamentos (DRE)

540px.
- **Cabeçalho:** período · nome da categoria · total · "N itens, por competência".
- **Lista:** data ou mês · descrição (contraparte + item) · valor. Clique abre a ficha universal do lançamento.
- **Equipe de entrega e equipe administrativa:** a lista mostra **por função** (ex.: "Social Media, 22 de 22 vagas") com a nota "Equipe aparece por função. O valor por pessoa fica restrito a quem tem permissão de ver remuneração, em Pagamentos › Folha." Com `view_compensation`, há um botão "Ver por pessoa".

### 8.2 Ficha de rentabilidade do cliente

640px.

| Seção | Conteúdo |
|---|---|
| **Cabeçalho** | Nome · selo de saúde · squad, serviços, receita · **margem de contribuição em R$ e %** |
| **Da receita à margem** | Cascata horizontal: receita → deduções → **equipe por função** (Social Media, Tráfego, Design, Audiovisual, CS) → custos diretos → margem. Texto: "Equipe aparece por função, não por pessoa" |
| **Margem % em 12 meses** | Linha, com a referência tracejada do limite saudável |
| **Esforço vs. contrato** (só com o módulo de Operação) | Entregas contratadas × realizadas no mês. Acima de +20%: destaque vermelho e o texto "Recebe X% mais entregas do que contratou. A margem baixa vem de escopo escapando, não de preço: vale renegociar o escopo antes do fee." Dentro: "Esforço dentro do contratado. Se a margem estiver baixa, o problema é preço, não escopo." |
| **Simular preço** | Campo com o fee mensal atual (editável) → margem recalculada com o mesmo custo mensal. Texto: "Fee atual de R$ X e custo mensal de R$ Y. Para a margem chegar a 55% (saudável), o fee precisa ser de R$ Z, um reajuste de W%." |
| **Alocação de equipe no mês** | Por função: vagas · custo por vaga · valor. Link "Ajustar alocação em Pagamentos, Folha" |
| **Custos diretos do período** | Lista de lançamentos |

**Fórmulas do simulador:**
- custo mensal = (equipe + custos diretos do período) ÷ número de meses;
- margem simulada = (fee × (1 − alíquota efetiva) − custo mensal) ÷ (fee × (1 − alíquota efetiva));
- fee para a margem alvo = custo mensal ÷ ((1 − alíquota efetiva) × (1 − margem alvo)).

O simulador **não grava nada**; é só leitura. Evolução: botão "Usar como proposta de reajuste", que abre o reajuste da recorrência em Recebimentos.

---

## 9. Regras de cálculo

| Tema | Regra |
|---|---|
| **Regime** | Competência sempre. Mês aberto = realizado + previsto (parcelas abertas com competência no mês) |
| **Mês fechado** | Números congelados. Ajustes posteriores aparecem no selo e nas linhas afetadas |
| **Receita recorrente vs. pontual** | Recorrente = item de título com `recurrence_id`. Pontual = demais `operating_revenue` |
| **Deduções por cliente/serviço** | Alíquota efetiva do período (deduções ÷ receita bruta) × receita |
| **Equipe** | Vagas × custo por vaga. Custo por vaga = custo da função ÷ max(capacidade, vagas usadas) (documento-mãe, 15.1) |
| **Vagas do mês** | Recorrentes (cliente com MRR no mês) + pontuais/projeto (`team_allocations` com `project_id`) |
| **Ociosidade** | Custo da função − vagas usadas × custo por vaga. Linha própria; nunca distribuída |
| **Operação geral** | Custos diretos sem cliente. Linha própria; nunca distribuída |
| **Estrutura** | Despesas operacionais. Não entram na margem de contribuição |
| **Alocação** | Mensal, congelada no fechamento (documento-mãe, 15.2) |
| **Movimentos de MRR** | Pelas versões e status das recorrências, na data de vigência (seção 7.2) |
| **Pausa** | Sai do MRR; não é churn |
| **Concentração** | Por receita bruta do período (recorrente + pontual) |

---

## 10. Validações (invariantes)

### 10.1 Rentabilidade = DRE

```
Σ margem de contribuição dos clientes − capacidade ociosa − operação geral − despesas operacionais ± resultado financeiro = resultado líquido da DRE
```

Tolerância: R$ 1. **Causas prováveis exibidas quando não confere:**
- colaborador de entrega sem alocação no mês ("R$ X de equipe não distribuídos") → Pagamentos › Folha;
- item de receita sem cliente → lançamento;
- item de custo direto com cliente inativo ou inexistente → lançamento;
- alocação apontando para cliente sem receita no mês (vaga "órfã") → alocação.

### 10.2 Ponte do caixa = Caixa

```
Resultado líquido + variações da ponte = variação do saldo disponível (Caixa) no período
```

Não conferindo, as causas prováveis são:
- movimentação conciliada com título de competência diferente e classificação `internal` incorreta;
- transferência classificada como receita ou despesa;
- lançamento direto sem título.

Link: "Analisar diferença", que abre uma lista das movimentações do período sem vínculo coerente.

---

## 11. Automações

| Automação | Frequência |
|---|---|
| Cálculo da DRE, da rentabilidade e dos movimentos de MRR | Views/funções no banco; mês aberto recalculado sob demanda |
| Congelamento da rentabilidade e da alocação | No fechamento do mês |
| Decomposição da variação + notas | Ao carregar a página (cache por período + comparação) |
| Validações 10.1 e 10.2 | Ao carregar; divergência gera aviso ⚪ no Dashboard |
| Selo de saúde por cliente | Recalculado no fechamento e diariamente para o mês aberto; exposto ao CS |
| Alertas informativos no Dashboard | Cliente crítico em 2 meses seguidos; concentração acima do limite; projeto estourando o orçado; função acima da capacidade |
| Relatório mensal em PDF | Sob demanda (futuro: automático no fechamento) |

---

## 12. Integrações e funcionamento independente

| Módulo | Uso nesta página | Sem o módulo |
|---|---|---|
| **Pagamentos › Folha** | Custo por função, capacidade, alocação (cliente, serviço, projeto) | — (é do próprio Financeiro) |
| **Recebimentos** | Receita, recorrências, versões e motivos | — |
| **Caixa** | Variação do disponível (ponte) | — |
| **Planejamento** | Comparação com o orçado | Opção "Orçado" desabilitada |
| **Operação** | Entregas contratadas × realizadas; alocação sugerida por tasks | "Esforço vs. contrato" não aparece; alocação manual |
| **CS** | Recebe o selo de saúde por cliente (sem números) | — |

---

## 13. Ajustes no modelo de dados (incluir no documento-mãe)

1. **`team_allocations.service_id`** e **`team_allocations.project_id`** (opcional), além de `client_id` e `weight`.
2. **`parties` (colaborador): `primary_service_id`**, o serviço padrão das vagas do colaborador.
3. **`projects`:** `contract_value`, `budget_cost`, `status` (`in_progress`, `done`, `cancelled`), `start_date`, `end_date`, `client_id`.
4. **`clients.squad_id`** (já previsto nas decisões-mãe do ERP; aqui é obrigatório para a visão Squads).
5. **`mrr_movements`** (view): `month`, `client_id`, `recurrence_id`, `type` (`new`, `reactivation`, `expansion`, `contraction`, `churn`, `pause`, `resume`), `amount`, `reason`, `effective_date`.
6. **`client_profitability_monthly`** (tabela congelada no fechamento; view para mês aberto): `month`, `client_id`, `revenue_recurring`, `revenue_one_off`, `deductions`, `team_cost` (jsonb por função), `direct_costs`, `margin`, `margin_pct`, `slots`, `health`.
7. **`period_adjustments`** (view sobre `audit_events`): alterações em itens de período fechado, com linha da DRE, valor, justificativa, usuário e data.
8. **`deliverables_actual`** (quando houver Operação): entregas realizadas por cliente e mês, para "Esforço vs. contrato" (o contratado vem de `client_deliverables`).

---

## 14. Parâmetros configuráveis

| Parâmetro | Padrão |
|---|---|
| Margem de contribuição saudável | ≥ 55% |
| Margem de contribuição em atenção | 40% a 55% (abaixo: crítica) |
| Limite de concentração por cliente | 15% da receita |
| Limite de churn de MRR (alerta) | 2% ao mês |
| Tolerância "esforço acima do contratado" | +20% |
| Limite de custos diretos sem cliente para alerta | 5% dos custos diretos |
| Barra de orçado do projeto: âmbar a partir de | 85% |
| Margem alvo do simulador | Igual ao limite saudável |

---

## 15. Permissões e auditoria

- A página é acessível a **diretoria e perfis do Financeiro**.
- **`view_compensation`** controla o detalhamento por pessoa (drawer de lançamentos de pessoal, "Ver por pessoa"). Sem ela, só aparecem valores por função e totais.
- A visão **Squads** nunca exibe valores individuais, independentemente da permissão.
- **O CS não acessa a página.** Recebe apenas o selo de saúde, no módulo de CS.
- **Auditoria:** exportação de relatório (quem, período); alteração dos parâmetros de saúde e concentração.

---

## 16. Casos de borda

- **Cliente só com receita pontual no período** (projeto): aparece na matriz e na tabela; a tendência usa apenas os meses com receita.
- **Cliente novo no meio do mês:** receita e vagas proporcionais ao que foi faturado e alocado; a tendência mostra "novo".
- **Cliente com receita e sem alocação:** margem artificialmente alta. Aparece um aviso na linha ("sem equipe alocada") e ele entra nas causas prováveis se a prova não fechar.
- **Mês sem nenhuma alocação** (implantação): a prova de fechamento mostra "Alocação de {mês} não preenchida" e a rentabilidade por cliente exibe só receita, deduções e custos diretos.
- **Função com capacidade zero:** custo integral vai para ociosidade até a capacidade ser definida; alerta.
- **Resultado negativo:** "Para cada R$ 100" mostra o prejuízo; a cascata do caixa funciona normalmente.
- **Comparação com período sem dados** (primeiros meses): o Δ mostra "—" e a variação explicada exibe "Sem período de comparação".
- **Trimestre com meses fechados e abertos:** o selo mostra "Em aberto"; o modo Período usa colunas simples (sem realizado/previsto por mês).
- **Projeto sem custo orçado:** a coluna mostra só o acumulado, com "Sem orçado".
- **Recorrência editada com vigência retroativa:** os movimentos de MRR são recalculados; em períodos fechados, a mudança aparece como ajuste após o fechamento.

---

## 17. Fora do escopo desta versão

- Rateio opcional da estrutura para "resultado por cliente" (sempre separado da margem de contribuição).
- Coortes de clientes (retenção por safra de entrada).
- LTV e CAC.
- Envio automático do relatório mensal.
- Comentário de IA sobre o mês.
- Granularidades Ano, Últimos 12 meses e Personalizado.
