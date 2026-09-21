# Viofilme ERP — Financeiro
## Página 6: Planejamento

**Versão:** 1.0 · setembro/2026
**Público:** desenvolvimento (Gui)
**Documento-mãe:** `viofilme_financeiro_regras_gerais.md`. Em caso de conflito, o documento-mãe prevalece.

**Specs relacionadas:**
- Recebimentos: MRR, recorrências, versões, churn e ticket.
- Pagamentos: folha, capacidade, recorrências de despesa e estimativas.
- Caixa: motor de projeção de caixa.
- Resultados: realizado por competência, margem, ocupação e comparação com o orçado.
- Dashboard: exceções de orçamento.

**Mockup de referência:** https://claude.ai/artifact/GNkMKnWtGomTYaVmHW3qBC. Os dados são fictícios; o churn de referência usado foi 2,5% ao mês.

---

## Sumário

1. Objetivo
2. Princípios da página
3. Estrutura
4. Faixa da rotina
5. Aba Orçamento
6. Revisão do mês
7. Assistente "Montar o orçamento"
8. Aba Projeção
9. Aba Cenários
10. Motores de cálculo
11. Regras de negócio
12. Automações
13. Integrações e funcionamento independente
14. Ajustes no modelo de dados (incluir no documento-mãe)
15. Parâmetros configuráveis
16. Permissões e auditoria
17. Casos de borda
18. Fora do escopo desta versão

---

## 1. Objetivo

Planejamento é a página do **futuro**. Ela responde três perguntas:

| Aba | Pergunta | Natureza |
|---|---|---|
| **Orçamento** | Qual é o plano do ano e como estamos em relação a ele? | Plano versionado, feito de premissas, e acompanhamento |
| **Projeção** | Se nada mudar, onde o ano termina? | Automática, a partir dos dados reais, mais eventos previstos |
| **Cenários** | E se…? | Perguntas rápidas e cenários de 12 meses |

**Contexto de uso:** hoje o planejamento é feito de cabeça, no papel e no quadro branco. A página precisa ensinar a rotina e fazer as contas, sem virar uma planilha de categorias × meses para preencher.

---

## 2. Princípios da página

1. **O plano é feito de premissas, não de números.** O usuário define premissas ("1,2 cliente novo por mês", "contratar social media em janeiro") e o sistema gera os números mês a mês. Números podem ser sobrescritos (ajuste manual), mas a origem é sempre a premissa.
2. **Tudo começa com uma sugestão tirada do histórico.** Toda premissa vem com um valor sugerido e a origem ("média dos últimos 6 meses").
3. **O que já está no sistema não é planejado de novo.** Recorrências, folha, contratos e parcelas alimentam a projeção. Planejamento é a camada do que ainda não existe.
4. **O plano aprovado não muda.** Mudanças criam uma revisão (nova versão); a original fica para comparação.
5. **A rotina é parte do produto.** A página diz qual é o próximo passo do ciclo de planejamento.
6. **Capacidade faz parte do plano.** Crescer em receita exige vagas de equipe. Orçamento e cenários sempre verificam isso.
7. **Não é FP&A.** Três cenários prontos, quatro perguntas rápidas, um orçamento por ano.

---

## 3. Estrutura

```
Cabeçalho: "Planejamento" + subtítulo     (versão vigente)  [Montar orçamento de {ano+1}]
Faixa da rotina (próximo passo do ciclo)
Abas: Orçamento · Projeção · Cenários
```

- **Versão vigente** à direita do cabeçalho: "Orçamento 2026 v1, aprovado em 15/12/2025".
- **Botão principal:**
  - "Montar orçamento de {ano+1}" (a partir de novembro, ou a qualquer momento);
  - "Ver orçamento de {ano+1}" se já existir aprovado.

**Overlays:**
- revisão do mês (640px);
- pergunta rápida (560px);
- assistente de orçamento (1040px);
- toast.

---

## 4. Faixa da rotina

Uma faixa abaixo do cabeçalho, sempre visível, com **um único próximo passo** e o calendário do ciclo.

| Ritmo | Quando aparece | Texto (exemplo) | Ação |
|---|---|---|---|
| Mensal | Após o fechamento de um mês com revisão pendente | "Revisão de agosto: 3 desvios para comentar. Leva uns 15 minutos." | **Começar revisão** |
| Trimestral | Após o fechamento de março, junho, setembro e dezembro | "Revisão do 3º trimestre: manter o orçamento ou criar uma revisão?" | Abrir comparação orçado × projeção + "Criar revisão" |
| Anual | A partir de 1º de novembro, sem orçamento do ano seguinte aprovado | "Hora de montar o orçamento de 2027" | **Montar orçamento** |
| Em dia | Nada pendente | "Revisão de agosto concluída hoje por Iago Lima. Próxima: setembro, após o fechamento." | — |

- **Prioridade quando há mais de um pendente:** mensal > trimestral > anual.
- **Estilo:** pendente = borda e fundo na cor de destaque; em dia = neutro com ícone verde.
- À direita, o calendário fixo: "Anual: novembro · Mensal: após o fechamento · Trimestral: set, dez, mar, jun".

---

## 5. Aba Orçamento

### 5.1 Metas financeiras do ano

Cinco cartões gerados pela versão aprovada (`budget_goals`):

| Meta | Meta | Atual | No ritmo |
|---|---|---|---|
| MRR em dezembro | MRR de dezembro do orçamento | MRR hoje + % da meta | MRR de dezembro da Projeção |
| Receita do ano | Σ receita bruta orçada | Realizado até o último mês fechado | Receita do ano projetada |
| Margem operacional | Resultado operacional ÷ receita líquida orçados | Acumulada no ano | Projetada |
| Resultado do ano | Σ resultado orçado | Acumulado | Projetado |
| Caixa mínimo | Reserva mínima (Configurações) | Menor saldo projetado + data (Caixa) | "Dentro da meta" / "Abaixo" |

- **Cor pelo "no ritmo" em relação à meta:** verde ≥ 98%, âmbar 92–98%, vermelho < 92%. Para margem: verde se ≥ meta − 0,5 p.p., âmbar até −2 p.p., vermelho abaixo. Borda vermelha nos cartões em risco.
- Barra de progresso = atual ÷ meta.

### 5.2 Orçado × realizado

- **Controles:** Mês | Acumulado do ano · navegação de mês (até o mês corrente).
- **Linhas** (grupos gerenciais, mapeados por categoria):

| Linha | Sinal |
|---|---|
| Receita recorrente | + |
| Receita pontual | + |
| Impostos | − |
| Equipe de entrega | − |
| Custos variáveis de produção | − |
| Pró-labore e encargos | − |
| Equipe administrativa | − |
| Comercial e comissões | − |
| Estrutura e contabilidade | − |
| Softwares | − |
| Transporte e alimentação | − |
| Resultado financeiro | ± |
| **Resultado** | total |

> O agrupamento vem de um campo **`budget_line`** na categoria (Configurações), para não depender de nomes fixos.

- **Colunas:** Linha · Orçado · Realizado (clicável: drawer de lançamentos, o mesmo de Resultados) · Desvio R$ · Desvio % · Farol · Comentário.
- **Mês em aberto:** realizado = realizado + previsto por competência, com o subtítulo "Setembro em aberto: realizado + previsto".

**Farol** (desvio desfavorável = receita abaixo ou custo acima do orçado):

| Farol | Regra |
|---|---|
| Verde | Desvio favorável ou |desvio| ≤ 10% |
| Âmbar | Desfavorável, > 10%, e |desvio| ≤ R$ 500 |
| Vermelho | Desfavorável, > 10%, e |desvio| > R$ 500 → **exige comentário na revisão do mês** |

- **Comentário:** texto vindo da revisão do mês (`variance_comments`). Linhas vermelhas sem comentário mostram "Comentar na revisão do mês" em âmbar.
- **Legenda do farol** no rodapé.

### 5.3 Premissas do orçamento

- Cartões por grupo:
  - receita recorrente;
  - receita pontual;
  - equipe;
  - custos fixos;
  - variáveis e impostos;
  - investimentos e distribuições.
- Cada premissa mostra o nome, o valor e **a origem da sugestão** ou quem alterou ("Sugestão: 0,9 (média de 6 meses)", "Adicionada por Iago Lima").
- **Clique numa premissa:** abre a edição com o **efeito no ano antes de salvar** ("Resultado do ano: −R$ 12.400"). Em versão aprovada, salvar **cria uma revisão** (5.4).
- Botão **"Criar revisão do orçamento"**.
- Rodapé: "Versão aprovada em dd/mm/aaaa por {usuário}. Aprovada, ela não muda: ajustes viram uma revisão, e a original continua disponível para comparar."

### 5.4 Versões

- **Status:** `draft` → `approved` → `archived`.
- **Revisão:** copia as premissas da versão vigente para um novo `draft` ("Orçamento 2026, revisão de setembro"). Aprovar a revisão a torna a vigente; a anterior fica `archived`, mas consultável.
- **A comparação padrão** (Orçado × realizado, Resultados › Comparar com Orçado, Pagamentos › prévia, Dashboard I2) usa a **versão aprovada mais recente**. Há a opção de comparar com a **versão original** do ano.
- Um ano pode ter no máximo uma versão `approved` vigente e várias `archived`.

---

## 6. Revisão do mês

É um drawer de 640px, com **3 passos** e barra de progresso. Aberto pela faixa da rotina ou pelos comentários pendentes.

### Passo 1 · Desvios

- Texto: "N linhas ficaram fora da tolerância em {mês}. Para cada uma: por que aconteceu, e se é pontual ou muda o resto do ano."
- **Um cartão por linha com farol vermelho:**
  - nome e desvio (R$ e %);
  - orçado e realizado;
  - **"O que explica":** os lançamentos que mais contribuíram para a diferença (mesma lógica da variação de Resultados, até 3 itens);
  - campo **Comentário**;
  - **classificação obrigatória:**
    - **Pontual** ("Não muda o plano");
    - **Permanente** ("Atualiza a projeção do ano"): cria um `forecast_event` com a diferença mensal a partir do mês seguinte, na categoria correspondente.
- **Continuar** só com todos os desvios classificados. O comentário é recomendado, não obrigatório; sem comentário, a linha continua marcada na tabela.

### Passo 2 · Metas no ritmo

Os 5 cartões de meta em formato de lista, com a projeção já atualizada pelos desvios permanentes.

### Passo 3 · Concluir

- Resumo:
  - quantos desvios foram comentados;
  - quais foram classificados como permanentes e o efeito na projeção;
  - metas em risco e em atenção.
- **"Concluir revisão":** grava `budget_reviews` (mês, versão, usuário, data) e os `variance_comments`. A faixa da rotina passa para "em dia".

---

## 7. Assistente "Montar o orçamento"

Drawer de 1040px:
- **topo:** 6 passos clicáveis com barra;
- **esquerda:** premissas do passo, com o texto de introdução;
- **direita (340px):** **prévia viva do ano**;
- **rodapé:** Voltar/Cancelar · Continuar/Aprovar.

Também é aberto por **Cenários › "Usar como base do orçamento"**, com as alavancas do cenário como premissas iniciais.

### 7.1 Passos e premissas

Cada campo mostra o **valor sugerido e a origem** abaixo do rótulo.

| Passo | Premissas | Sugestão padrão |
|---|---|---|
| **1. Receita recorrente** | MRR inicial (somente leitura) · Novos clientes/mês · Ticket dos novos · Churn mensal · Reajuste em janeiro (%) | MRR de dezembro da Projeção (com eventos confirmados) · média de novos dos últimos 6 meses · ticket médio atual · churn médio de 12 meses (contrações e pausas incluídas) · IPCA estimado |
| **2. Receita pontual** | Receita pontual/mês · Sazonalidade (% nos meses fortes) | Média de 12 meses · padrão do ano anterior (quando houver) |
| **3. Equipe** | Folha atual (somente leitura) · **Contratações planejadas** (função, mês, remuneração) · Reajuste de remuneração (% e mês) | Folha de Pagamentos › Folha · data-base mais comum dos contratos |
| **4. Custos fixos** | Por grupo: Manter / Reajustar % / Definir valor · Novos custos fixos (descrição, valor, início) | Valores atuais das recorrências de despesa |
| **5. Variáveis e impostos** | Impostos (% receita) · Custos variáveis de produção (% receita) · Comissões (% da receita nova) | Alíquota efetiva do ano · % médio de 12 meses · regra comercial |
| **6. Investimentos e revisão** | Investimentos (o quê, quanto, quando) · Distribuição de lucros (% do resultado, trimestral, ou valores) · **DRE planejada mês a mês** (receita, custos, resultado, caixa, em R$ mil) | — |

### 7.2 Aviso de capacidade (passo 3 e prévia)

O sistema calcula, mês a mês, as **vagas necessárias** por função (vagas atuais − vagas de clientes que saem pelo churn + vagas dos clientes novos, com a média de vagas por cliente de cada função) e compara com a **capacidade planejada** (atual + contratações).

- **Primeiro mês em que necessário > capacidade:** faixa âmbar "Em {mês} o plano precisa de X vagas de {função} e a equipe tem Y. Planejar uma contratação?" + botão **"Planejar contratação"**, que adiciona a contratação da função naquele mês com a remuneração de referência.
- Após adicionar, o aviso reaparece só se a nova capacidade também estourar mais adiante.
- A contratação adiciona capacidade (padrão da função em Configurações, ex.: social media = 11 vagas) e custo.

### 7.3 Prévia viva

Seis indicadores, recalculados a cada alteração:

1. **Receita do ano** + "% recorrente".
2. **Resultado do ano** + margem operacional.
3. **MRR em dezembro** + variação no ano.
4. **Menor saldo de caixa** + mês ("abaixo da reserva" em vermelho).
5. **Equipe no fim do ano** (R$/mês) + número de contratações.
6. **Capacidade:** "Comporta o plano" (verde) / "Estoura em {mês}" (âmbar).

### 7.4 Aprovação

"Aprovar orçamento de {ano}" cria a versão `approved` com:
- as premissas (`budget_assumptions`);
- os valores por categoria × mês (`budgets`, `source = assumption`);
- as metas (`budget_goals`).

A versão passa a valer como referência a partir de janeiro do ano.

---

## 8. Aba Projeção

### 8.1 Premissas da projeção (chaves)

| Chave | Padrão | Efeito |
|---|---|---|
| Incluir pontual pela média | **Ligada** | Meses futuros: receita pontual = max(parcelas contratadas, média de 6 meses) |
| Incluir novos clientes pelo ritmo atual | Desligada | Soma novos clientes ao ritmo médio de 6 meses × ticket médio |
| Incluir eventos prováveis | Ligada | Eventos com confiança "Provável" entram na projeção |
| Incluir pipeline | Desabilitada | "Quando o Comercial estiver integrado" |

As chaves são persistidas por usuário.

### 8.2 Pouso do ano

Quatro cartões: **Receita do ano · Resultado do ano · MRR em dezembro · Caixa em dezembro**. Cada um mostra o valor projetado, o orçado e o Δ% (verde se melhor que o orçado, âmbar se até −3%, vermelho abaixo).

### 8.3 Gráfico do ano

- Barras de **resultado** por mês: realizado sólido, mês corrente hachurado, projetado com contorno tracejado.
- Linha tracejada âmbar do **orçado**.
- Tooltip por mês: resultado e orçado.

### 8.4 Tabela do ano (R$ mil)

- **Linhas:** Receita recorrente · Receita pontual · Custos e despesas · **Resultado**.
- **Colunas:** jan–dez + Ano (projetado) + Orçado + Δ%. Meses projetados em itálico com fundo sutil; o mês corrente com fundo na cor de destaque suave.
- **Clique em qualquer valor:** a origem ("Realizado em agosto", "MRR vigente de R$ X + eventos previstos", "Parcelas contratadas ou média de 6 meses, o que for maior", "Recorrências de despesa, folha e % médio da receita").

### 8.5 Eventos previstos

É a única parte editável da projeção.

**Lista:** tipo (selo colorido) · descrição · "a partir de {mês}" · valor (R$ ou R$/mês) · confiança (Confirmado / Provável) · ação.

| Tipo | Efeito | Recorrente? |
|---|---|---|
| Cliente novo | + receita recorrente a partir do mês | Sim |
| Cliente vai sair | − receita recorrente a partir do mês | Sim |
| Mudança de fee | ± receita recorrente a partir do mês | Sim |
| Contratação | + custo de equipe a partir do mês (+ capacidade) | Sim |
| Gasto pontual | + custo no mês | Não |
| Receita pontual | + receita no mês | Não |
| Desvio permanente (da revisão) | ± na categoria a partir do mês seguinte | Sim |

- **Formulário inline** para adicionar: tipo, descrição, a partir de, valor, confiança. Valores de saída são normalizados como negativos.
- **Resolução automática:** um job diário procura o registro real correspondente:
  - cliente novo → recorrência criada para o cliente/valor;
  - saída → recorrência encerrada;
  - contratação → colaborador na folha;
  - gasto ou receita pontual → título no mês.

  Encontrando, o evento fica **"Já aconteceu: {registro} em dd/mm"** (verde), com o botão **"Remover da projeção"**, para não contar em dobro.
- **Eventos com data passada sem correspondência:** marcados "Não aconteceu?" para revisão.
- Ações: **Excluir** (evento aberto) / **Remover da projeção** (evento resolvido).

---

## 9. Aba Cenários

### 9.1 Perguntas rápidas

Quatro cartões (ícone, pergunta, subtítulo). Cada um abre um drawer com entradas, **resposta em destaque** (verde, âmbar ou vermelho), linhas de números, nota explicativa e ações.

**1. Posso contratar alguém?**
- **Entradas:** função, remuneração (padrão da função), a partir de.
- **Números:**
  - custo nos próximos 12 meses;
  - efeito no resultado mensal;
  - **menor saldo de caixa depois** (projeção base − remuneração acumulada);
  - vagas que a pessoa libera;
  - **ocupação atual da função** (de Resultados › Squads);
  - **clientes novos que pagam a contratação** = remuneração ÷ (ticket médio × (1 − alíquota) × margem de contribuição média).
- **Resposta:**
  - "Sim. O caixa aguenta e a função já está no limite." (ocupação ≥ 95% e caixa ≥ reserva);
  - "O caixa aguenta, mas a função ainda tem espaço.";
  - "Com cuidado: o caixa fica abaixo da reserva."
- **Ações:** **Adicionar à projeção como evento** (Contratação, provável) · Guardar como cenário.

**2. E se perdermos um cliente?**
- **Entrada:** cliente (lista ordenada por margem de contribuição em R$).
- **Números:**
  - receita perdida por mês;
  - margem de contribuição perdida;
  - **equipe que vira ociosidade**;
  - efeito no resultado em 12 meses;
  - participação na receita;
  - meses de vendas para repor (fee ÷ ritmo de novos × ticket).
- **Resposta:** "O resultado cai R$ X por mês, não só a margem de R$ Y."
- **Por quê:** a equipe do cliente continua sendo paga. O resultado cai quase pelo fee líquido inteiro até as vagas serem reocupadas.
- **Ações:** Adicionar à projeção (Cliente vai sair, provável) · Guardar como cenário.

**3. Quanto preciso vender?**
- **Entradas:** meta (MRR em {mês/ano+1} ou resultado dos próximos 12 meses) e valor.
- **Números:**
  - ritmo atual;
  - **ritmo necessário (clientes/mês)**;
  - receita nova por mês;
  - vagas de social media necessárias em 12 meses vs. livres hoje;
  - contratações necessárias.
- **Cálculo (MRR):** novos/mês = (meta − MRR atual × (1 − churn)^12) ÷ (ticket × Σ(1 − churn)^(11−i)).
- **Ação:** Guardar como cenário.

**4. Posso distribuir lucros?**
- **Entradas:** valor extra (além das distribuições planejadas) e mês.
- **Números:**
  - menor saldo projetado antes;
  - menor saldo depois;
  - reserva mínima;
  - **máximo que mantém a reserva** (menor saldo − reserva).
- **Resposta:** "Sim, o caixa continua acima da reserva" / "Não com esse valor".
- **Ação:** Guardar como cenário.

### 9.2 Cenários dos próximos 12 meses

- **Horizonte:** do próximo mês até 12 meses à frente.
- **Três cenários prontos lado a lado** (até 4 com "Novo cenário", que copia a Base):

| Alavanca | Conservador | Base | Agressivo |
|---|---|---|---|
| Novos clientes por mês | 0 | Ritmo atual | ~1,7× o ritmo |
| Churn mensal | ~1,6× a média | Média de 12 meses | ~0,7× a média |
| Ticket dos novos | Atual | Atual | Atual |
| Pontual vs. média | −30% | 0% | +20% |
| Custos fixos | 0% | 0% | +5% |
| Contratar sozinho quando a capacidade estourar | Não | Não | **Sim** |

> Os multiplicadores são o padrão inicial (Configurações). No mockup: 0 / 1,2 / 2 novos; 4% / 2,5% / 1,8% de churn.

- **Cada cartão:**
  - nome e subtítulo ("se der errado", "se continuar assim", "se der certo");
  - alavancas editáveis inline;
  - chave "Contratar sozinho quando a capacidade estourar".
- **Resultados do cartão:**
  - receita em 12 meses;
  - resultado em 12 meses;
  - margem operacional;
  - MRR no fim;
  - **menor saldo de caixa + mês** (vermelho se abaixo da reserva);
  - diferença de resultado para a Base.
- **Linha de capacidade:**
  - "Contrataria {função} em {meses} (R$ X cada, N vagas)";
  - "Sem contratação: a capacidade de {função} estoura em {mês}" (âmbar);
  - "A equipe atual comporta este cenário".
- **Botão "Usar como base do orçamento de {ano+1}":** abre o assistente com as alavancas como premissas.

**Gráfico:** saldo de caixa em 12 meses, uma linha por cenário (cores dos cartões; o cenário personalizado em tracejado), reserva mínima tracejada e linha do zero. Nota: "Inclui as distribuições de lucros planejadas, investimentos programados e as aplicações mensais na reserva."

---

## 10. Motores de cálculo

É uma **única biblioteca de simulação mensal** no back-end (função ou Edge Function), usada por assistente, projeção, cenários e perguntas rápidas, parametrizada por:

```
estado inicial: MRR, nº de clientes, vagas usadas e capacidade por função, folha, custos fixos, saldo de caixa
por mês:
  clientes_saindo = clientes × churn
  MRR = MRR × (1 − churn) + novos × ticket  (+ reajuste no mês definido, + eventos recorrentes)
  vagas_usadas[f] = vagas_usadas[f] − vagas_por_cliente[f] × clientes_saindo + vagas_por_cliente[f] × novos
  se vagas_usadas[f] > capacidade[f]: contratar (se automático) ou registrar estouro
  receita_pontual = base × (1 + ajuste) × sazonalidade(mês)
  impostos = receita × alíquota
  variáveis = receita × % produção + receita nova × % comissão
  equipe = folha × reajuste(mês) + Σ contratações ativas
  fixos = Σ grupos (manter / reajustar / valor) + novos fixos
  resultado = receita − impostos − variáveis − equipe − fixos ± financeiro
  caixa = caixa + resultado × fator_de_conversão − distribuições − investimentos − aplicações na reserva
```

- **Fator de conversão resultado → caixa:** média histórica da razão entre a variação do disponível operacional e o resultado (padrão 0,95; recalculado mensalmente).
- **Vagas por cliente por função:** média atual da carteira (de `team_allocations`).
- **A projeção (aba 8) usa dados reais**, não premissas:
  - realizado por competência nos meses passados;
  - realizado + previsto no mês corrente;
  - para os meses futuros: MRR vigente com versões futuras, fins de contrato e pausas, parcelas contratadas, folha com versões futuras, recorrências de despesa, estimativas, % médio de variáveis e eventos.
- **Caixa:** a projeção e os cenários usam o **motor do Caixa** (spec do Caixa, 5.6) com as alterações aplicadas.

---

## 11. Regras de negócio

| Situação | Regra |
|---|---|
| **Premissa × número** | Números gerados pelas premissas. Sobrescrever uma célula cria `budgets.source = manual` com nota; sobrevive a recálculos e aparece marcado |
| **Versão aprovada** | Imutável; mudanças criam revisão |
| **Comparação padrão** | Versão aprovada mais recente; opção pela original |
| **Categoria sem orçamento** | Orçado "—", farol cinza |
| **Farol** | ±10% e R$ 500 (configurável por linha); só desvios desfavoráveis mudam de cor |
| **Revisão do mês** | Classificação obrigatória dos desvios vermelhos; "permanente" gera evento na projeção |
| **Projeção** | Não editável, exceto chaves e eventos |
| **Evento resolvido** | Não conta mais na projeção após a remoção (o registro real já conta). Sem remoção, o sistema **não soma em dobro**: evento resolvido é ignorado no cálculo automaticamente, e o botão só limpa a lista |
| **Cenários e perguntas rápidas** | Nunca alteram dados reais; só geram eventos quando o usuário pede |
| **Contratação automática** | Só em cenários; nunca no orçamento ou na projeção sem confirmação |
| **Capacidade** | Capacidade e vagas por função vêm da Folha; ocupação de Resultados |
| **Reserva mínima** | Mesmo parâmetro do Caixa e do Dashboard |

---

## 12. Automações

| Automação | Controle humano |
|---|---|
| Sugestões de premissas a partir do histórico | Sempre com origem visível e editável |
| Geração dos números do orçamento | Recalculada ao mudar premissa; ajustes manuais preservados |
| Projeção do ano | Recalculada diariamente e após cada fechamento/baixa relevante |
| Resolução de eventos previstos | Marca como "já aconteceu"; a remoção é manual |
| Aviso de capacidade | Sugere contratação; nunca cria sozinho no orçamento |
| Faixa da rotina | Mensal após o fechamento; trimestral após mar/jun/set/dez; anual a partir de novembro |
| **Alertas no Dashboard** | Categoria acima do orçado (I2, existente); **meta do ano em risco** (nova, ⚪, quando alguma meta fica vermelha no ritmo); **revisão do mês pendente há mais de 10 dias** (nova, ⚪) |

---

## 13. Integrações e funcionamento independente

| Fonte | Uso | Sem o módulo |
|---|---|---|
| Recebimentos | MRR, recorrências e versões, churn, ticket, parcelas pontuais contratadas | — |
| Pagamentos › Folha | Folha, versões de remuneração, capacidade e vagas por função | — |
| Caixa | Saldo, motor de projeção de caixa, reserva | — |
| Resultados | Realizado por competência, margem de contribuição, ocupação | — |
| **Comercial** (futuro) | Pipeline ponderado; ritmo de novos clientes real | Ritmo derivado das recorrências criadas |
| **RH** (futuro) | Contratações aprovadas viram vagas abertas | Contratações ficam como premissas/eventos |

---

## 14. Ajustes no modelo de dados (incluir no documento-mãe)

1. **`budget_versions`:** `id`, `year`, `name`, `status` (`draft`, `approved`, `archived`), `source_version_id`, `source_scenario_id`, `approved_by`, `approved_at`.
2. **`budget_assumptions`:** `version_id`, `type` (`new_clients`, `avg_ticket`, `churn`, `price_adjustment`, `one_off_revenue`, `seasonality`, `hire`, `salary_adjustment`, `fixed_cost`, `variable_cost_pct`, `commission_pct`, `tax_pct`, `investment`, `distribution`), `params` (jsonb), `start_month`, `end_month`, `suggested_value`, `suggestion_source`, `description`, `updated_by`, `updated_at`.
3. **`budgets`** (já existente) ganha `version_id`, `source` (`assumption`, `manual`), `assumption_id`, `note`.
4. **`categories.budget_line`:** grupo gerencial do Orçado × realizado.
5. **`budget_goals`:** `version_id`, `kpi` (`mrr_end`, `revenue_year`, `op_margin`, `result_year`, `min_cash`), `target`.
6. **`budget_reviews`:** `version_id`, `month`, `reviewed_by`, `reviewed_at`, `status`.
7. **`variance_comments`:** `version_id`, `month`, `budget_line`, `text`, `classification` (`one_off`, `permanent`), `forecast_event_id`, `author`, `created_at`.
8. **`forecast_events`:** `type`, `description`, `start_month`, `amount`, `recurring` (bool), `confidence` (`confirmed`, `likely`), `status` (`open`, `happened`, `expired`, `removed`), `resolved_ref` (tipo + id do registro real), `origin` (`manual`, `review`, `quick_question`), `created_by`.
9. **`scenarios`:** `name`, `subtitle`, `color`, `base` (`forecast`), `levers` (jsonb: novos, churn, ticket, pontual_pct, fixos_pct, auto_hire), `is_default` (os 3 prontos), `created_by`.
10. **Parâmetros por função** (Configurações): capacidade por pessoa e remuneração de referência, usados em contratações planejadas e perguntas rápidas.

---

## 15. Parâmetros configuráveis

| Parâmetro | Padrão |
|---|---|
| Tolerância do farol | ±10% e R$ 500 |
| Limites de cor das metas | 98% / 92% |
| Janela das sugestões | Novos e pontual: 6 meses; churn e variáveis: 12 meses |
| Fator de conversão resultado → caixa | 0,95 (recalculado) |
| Multiplicadores dos cenários prontos | Conservador: 0 novos, churn ×1,6, pontual −30% · Agressivo: novos ×1,7, churn ×0,7, pontual +20%, fixos +5%, contratação automática |
| Capacidade por pessoa, por função | Social Media 11 · Tráfego 16 · Design 18 · Audiovisual 7 · CS 24 |
| Início da rotina anual | 1º de novembro |
| Alerta de revisão pendente | 10 dias após o fechamento |

---

## 16. Permissões e auditoria

- A página é acessível a **diretoria e perfis do Financeiro**.
- **Aprovar orçamento e revisões:** somente diretoria.
- Perguntas rápidas que envolvem remuneração mostram valores de função, não de pessoas.
- **Auditoria:**
  - criação e aprovação de versões;
  - alteração de premissas (antes/depois);
  - ajustes manuais de células;
  - revisões mensais concluídas;
  - eventos criados, resolvidos e removidos;
  - cenários criados e usados como base.

---

## 17. Casos de borda

- **Primeiro ano sem histórico suficiente:** sugestões usam o período disponível e avisam ("baseado em 4 meses").
- **Sem orçamento aprovado para o ano corrente:** a aba Orçamento abre direto no assistente; Resultados desabilita "Comparar com Orçado".
- **Revisão de um mês sem nenhum desvio vermelho:** a revisão tem só os passos 2 e 3, e a faixa diz "Nenhum desvio relevante em {mês}".
- **Desvio favorável grande** (receita muito acima): não exige comentário, mas aparece na revisão como "destaque positivo" opcional.
- **Evento duplicado com registro real antes da resolução automática:** o job reconcilia na mesma noite; até lá, a projeção mostra um aviso "possível duplicidade" no evento.
- **Cenário com caixa negativo:** menor saldo em vermelho; o gráfico mostra a linha do zero.
- **Contratação planejada com capacidade ainda livre:** o assistente permite, mas avisa "ocupação de {função} em X%: a contratação pode esperar".
- **Churn sugerido muito diferente do mês atual:** a sugestão usa 12 meses para suavizar; o campo mostra também o último trimestre como referência.
- **Orçamento de ano seguinte montado antes do fim do ano corrente:** o MRR inicial vem da projeção de dezembro e é atualizado ao aprovar, com aviso se mudou mais de 5% desde a montagem.

---

## 18. Fora do escopo desta versão

- Pipeline comercial ponderado na projeção.
- Orçamento por centro de custo ou squad (v1: por categoria e empresa).
- Cenários com probabilidade e faixas de confiança.
- Sazonalidade aprendida automaticamente.
- Comentário de IA na revisão do mês.
- Orçamento plurianual.
