# Viofilme ERP — Financeiro
## Página 4: Caixa

**Versão:** 1.0 · setembro/2026
**Público:** desenvolvimento (Gui)
**Documento-mãe:** `viofilme_financeiro_regras_gerais.md` (seções 5, 13, 14 e 17 são a base desta página). Em caso de conflito, o documento-mãe prevalece.
**Specs relacionadas:** Dashboard (a projeção de 30 dias e as exceções de conciliação e extrato usam as mesmas regras daqui), Recebimentos e Pagamentos (a conciliação cria e confirma as baixas deles).
**Mockup de referência:** https://claude.ai/artifact/DUTJ1tpT4aaUtBJsTzURr7. Os dados do fluxo vêm de um modelo mensal com variação e são ilustrativos.

---

## Sumário

1. Objetivo
2. Conceitos desta página
3. Estrutura da página
4. Faixa de contas
5. Aba Fluxo de caixa
6. Aba Extrato
7. Importar extrato
8. Aba Conciliação
9. Ficha da movimentação
10. Ficha da conta financeira
11. Nova movimentação e nova transferência
12. Regras de negócio
13. Automações
14. Integrações e funcionamento independente
15. Ajustes no modelo de dados (incluir no documento-mãe)
16. Parâmetros configuráveis
17. Permissões e auditoria
18. Casos de borda
19. Fora do escopo desta versão

---

## 1. Objetivo

Caixa é o lugar do **dinheiro que de fato se moveu e que vai se mover**:

- **Recebimentos e Pagamentos** trabalham com compromissos (parcelas).
- **Caixa** trabalha com **movimentações** (`transactions`) e com a **projeção** delas.

A página tem duas naturezas:

- **Gerencial:** vou ter dinheiro? Quando aperta? Para onde está indo?
- **De controle:** o que está no sistema bate com o que aconteceu no banco? Se não bate, nenhum número das outras páginas é confiável.

| Aba | Pergunta | Objeto |
|---|---|---|
| **Fluxo de caixa** | Como o dinheiro vai se comportar e como se comportou? | Movimentações realizadas + parcelas previstas + projeção das recorrências |
| **Extrato** | O que passou em cada conta? | `transactions` |
| **Conciliação** | O que ainda não foi explicado? | Movimentações pendentes + baixas manuais sem confirmação |

**As contas financeiras não são uma aba:** ficam numa faixa fixa no topo (seção 4).

**Aba inicial:** Fluxo de caixa na primeira visita. Depois, a última aba usada pelo usuário (persistida). Links do Dashboard abrem direto na aba e no filtro corretos.

---

## 2. Conceitos desta página

### 2.1 Conferência de saldo

É o controle complementar à conciliação:
- a **conciliação** garante que cada movimentação foi explicada;
- a **conferência** garante que nenhuma movimentação ficou de fora e nenhuma foi duplicada.

**Como funciona:**
- Cada conta que usa extrato guarda **pontos de conferência** (`balance_checkpoints`): "em dd/mm, o banco dizia R$ X".
- **Origens do ponto:**
  - `ofx`: o saldo final informado no próprio arquivo (tag de saldo do OFX);
  - `manual`: "Informar saldo do banco";
  - `integration`: quando houver API.
- O sistema compara com o **saldo calculado** na mesma data e guarda a diferença.

| Resultado | Interface |
|---|---|
| Confere (diferença < R$ 0,01) | ✓ verde no cartão da conta e no extrato |
| Não confere | ⚠ vermelho: "Diferença de R$ X com o banco em dd/mm". Vira exceção 🟠 no Dashboard ("Saldo divergente em {conta}") até ser resolvida |

**Resolução:**
- automática, quando uma nova conferência bate (ex.: após importar as movimentações que faltavam);
- manual, por **lançamento de ajuste** com justificativa obrigatória, registrado na auditoria.

### 2.2 Blocos do fluxo

Toda movimentação cai em um bloco, derivado do `impact_type` da categoria (novo campo derivado `cash_flow_group`):

| Bloco | `cash_flow_group` | Linhas |
|---|---|---|
| **Operacional** | `operating` | Recebimentos de clientes · Outras receitas · Equipe e pró-labore · Custos diretos · Estrutura e softwares · Impostos · Faturas de cartão · Tarifas e rendimentos |
| **Investimentos** | `investing` | Equipamentos e outros ativos |
| **Sócios e financiamento** | `financing` | Aportes · Distribuição de lucros · Empréstimos (principal) |
| **Entre contas** | `internal` | Aplicações e resgates da reserva (só quando uma das contas está fora do disponível) |

**Mapeamento das linhas operacionais**, pelo grupo de categoria:
- receita operacional → Recebimentos de clientes;
- outras receitas e reembolsos → Outras receitas;
- pessoal (incluindo pró-labore) → Equipe e pró-labore;
- custo direto → Custos diretos;
- despesas operacionais de estrutura e software → Estrutura e softwares;
- deduções e impostos → Impostos;
- transferências para contas `credit_card` → Faturas de cartão;
- resultado financeiro → Tarifas e rendimentos.

**Por quê:** "o caixa caiu R$ 60 mil" tem significados opostos se foi operação, compra de equipamento ou distribuição aos sócios. Os blocos respondem isso sem abrir lançamento nenhum.

**Transferências** entre duas contas do disponível **não aparecem** no fluxo consolidado. Com uma conta filtrada, aparecem como entrada ou saída daquela conta.

### 2.3 Tipos de conta

| Tipo | `financial_accounts.type` | Particularidades |
|---|---|---|
| Banco | `bank` | Extrato por OFX/CSV (hoje) ou API (futuro) |
| Gateway | `gateway` | `liquidity_days`, `payout_rule`; taxas lançadas sozinhas; repasse ao banco = transferência |
| Reserva / investimento | `investment` | Fora do disponível por padrão; aplicação e resgate = transferência; rendimento = resultado financeiro |
| Cartão de crédito | `credit_card` | Saldo negativo = dívida; fechamento, vencimento, limite; fatura paga por transferência |
| Caixa físico | `cash` | Sem extrato; baixa manual é definitiva |

---

## 3. Estrutura da página

```
Cabeçalho: "Caixa" + subtítulo          [Nova transferência] [Importar extrato] [+ Movimentação]
Faixa de contas: Disponível | Inter | Asaas | Sicoob | Reserva | Cartão | + Conta
Abas: Fluxo de caixa · Extrato · Conciliação (badge)       Filtrado: {conta} [limpar]
```

- **Badge da Conciliação:** movimentações pendentes (sem contar o lado "espelho" de pares de transferência) + baixas sem confirmação.
- **Indicador de filtro:** quando há conta filtrada, aparece à direita das abas "Filtrado: {conta}" com "limpar".

---

## 4. Faixa de contas

### 4.1 Cartões

**Primeiro cartão, Disponível:**
- soma das contas com `counts_as_available = true`;
- "Cerca de X meses de fôlego";
- **clicar remove o filtro de conta**; fica destacado quando não há filtro.

**Um cartão por conta ativa**, nesta ordem: bancos, gateways, caixa físico, reservas, cartões de crédito. Cada cartão mostra:
- cor/ícone do tipo;
- nome;
- saldo calculado (vermelho se negativo);
- **uma linha de estado**, a de maior prioridade entre as que se aplicam.

| Prioridade | Estado | Cor |
|---|---|---|
| 1 | "Diferença de R$ X com o banco" (+ "Extrato há N dias", se também for o caso) | Vermelho |
| 2 | "Extrato sem importação há N dias" | Âmbar |
| 3 | "Confere com o banco em dd/mm. N para conciliar" | Cinza |
| 4 | "Confere com o banco em dd/mm" | Verde |
| — | Gateway: "Liquidez D+N, repasse {regra}" | — |
| — | Reserva: "Fora do disponível. Rendeu R$ X em {mês}" | Cinza |
| — | Cartão: "Fatura de R$ X, vence dd/mm" | Cinza |

**Aparência:**
- conta com diferença de saldo: borda vermelha suave;
- contas fora do disponível: fundo mais discreto.

**Interações:**
- **clique no cartão:** filtra a aba atual pela conta (clicar de novo remove o filtro);
- **⋯ no canto:** abre a ficha da conta (seção 10);
- **"+ Conta"** no fim da faixa: cadastro de conta (seção 10.4).

### 4.2 Efeito do filtro em cada aba

| Aba | Com conta do disponível | Com reserva ou cartão |
|---|---|---|
| Fluxo | Fluxo daquela conta (saldo inicial = saldo da conta; lançamentos com aquela conta prevista) | Mensagem explicando como a conta entra no caixa (reserva: "Entre contas"; cartão: "Faturas de cartão", com a indicação de ver as compras em Pagamentos › modo fatura) |
| Extrato | Movimentações da conta + **saldo corrido** + pontos de conferência | Movimentações da conta |
| Conciliação | Fila só daquela conta | Fila daquela conta (fatura importada) |

> **Implementação do fluxo por conta:** cada parcela aberta tem `expected_account_id` (conta prevista). O fluxo por conta usa só as parcelas e recorrências daquela conta. Parcelas sem conta prevista entram na conta padrão da direção (Configurações).

---

## 5. Aba Fluxo de caixa

### 5.1 Controles

- **Horizonte futuro:** 30 dias · 60 dias · 90 dias · 12 meses.
- **Granularidade automática** (texto explicativo ao lado):

| Horizonte | Granularidade | Passado exibido junto |
|---|---|---|
| 30 dias | Diária | 30 dias |
| 60 dias | Diária | 60 dias |
| 90 dias | Semanal | 13 semanas |
| 12 meses | Mensal | 6 meses |

- **Chave "Incluir recebimentos vencidos":** desligada por padrão. Ligada, o saldo vencido a receber entra como entrada **no dia seguinte a hoje**, e a nota do gráfico informa o valor.
- **Exportar:** planilha com o resumo e a tabela.

### 5.2 Resumo (6 cartões)

| Cartão | Definição |
|---|---|
| Saldo hoje | Disponível (ou saldo da conta filtrada) |
| Entradas previstas | Σ entradas de hoje ao fim do horizonte |
| Saídas previstas | Σ saídas no horizonte (inclui reserva e distribuições; o subtítulo informa) |
| Saldo no fim | Saldo projetado no último dia do horizonte + data |
| **Menor saldo** | Menor saldo **diário** projetado no horizonte + data; vermelho e "abaixo da reserva" se < reserva mínima |
| Fôlego | Saldo ÷ média mensal de saídas operacionais dos últimos 3 meses (sem investimentos, sócios e reserva) |

### 5.3 Gráfico (dois painéis com o mesmo eixo X)

**Painel superior: saldo.**
- Linha do saldo no fim de cada período: **contínua no realizado, tracejada no previsto**, com área suave.
- Linha tracejada âmbar da **reserva mínima**.
- Linha vertical pontilhada **"hoje"**, com rótulo. No mensal, fica na posição proporcional ao dia do mês.
- **Marcador do menor saldo** (círculo vermelho) no período que contém o dia do menor saldo diário, com o rótulo "mín. R$ X mil em dd/mm". **Usa o mesmo valor do cartão "Menor saldo"**, mesmo quando a granularidade é semanal ou mensal.
- Eixo Y com 3 linhas de grade em valores arredondados ("R$ 50 mil").

**Painel inferior: entradas e saídas.**
- Barras de entradas acima da linha central (verde) e de saídas abaixo (cinza).
- **Realizado:** preenchido. **Previsto:** só contorno. **Período misto** (contém hoje): preenchido com contorno.
- Altura proporcional ao maior valor absoluto visível.

**Interação:**
- **Hover** em qualquer período: coluna destacada + tooltip com o período, o tipo (realizado / realizado + previsto / previsto), entradas, saídas, saldo e **os três maiores eventos**.
- **Clique** num período: abre o drawer de lançamentos daquele período (5.5).
- **Rótulos do eixo X:** 5 marcas distribuídas.
- **Nota abaixo do gráfico:** legenda do sólido e contorno, o estado da chave de vencidos com o valor, e "Clique numa barra para ver os lançamentos".

### 5.4 Tabela "Fluxo por mês" (DFC gerencial)

**Colunas:**
- 2 meses anteriores (realizado);
- mês corrente ("real + prev");
- meses futuros até o fim do horizonte.
- Rótulo do tipo embaixo do nome do mês: "realizado" · "real + prev" · "previsto" (até 2 meses à frente) · **"projetado"** (além disso, baseado só nas regras de recorrência).
- Fundo das colunas: realizado neutro, mês corrente com leve cor de destaque, futuro levemente mais claro.
- Largura: 118px por mês + 240px da primeira coluna. **Rolagem horizontal com a primeira coluna fixa (sticky).**

**Linhas:**
```
Saldo inicial
OPERACIONAL                    (bloco, recolhível, soma das linhas)
  Recebimentos de clientes
  Outras receitas
  Equipe e pró-labore
  Custos diretos
  Estrutura e softwares
  Impostos
  Faturas de cartão
  Tarifas e rendimentos
INVESTIMENTOS
  Equipamentos
SÓCIOS E FINANCIAMENTO
  Distribuição de lucros (e aportes, empréstimos quando houver)
ENTRE CONTAS
  Aplicações na reserva
Saldo final
[Diferença vs. previsto no início do mês]   (só com a chave "Comparar com o previsto")
```

- **Formatação:** números sem "R$", positivos em verde, negativos em branco com "−", zero como "—". Saldos e blocos em negrito.
- **Clique em qualquer valor de linha** (não bloco, não saldo): abre o drawer de lançamentos (5.5). Células com zero não são clicáveis.
- **Blocos recolhíveis:** o chevron gira. O estado é persistido por usuário.
- **"Comparar com o previsto":** para meses passados, mostra a diferença entre o saldo final realizado e o **saldo final que o sistema projetava no primeiro dia daquele mês** (verde se melhor, âmbar se pior).
  - **Implementação:** snapshot mensal da projeção (`cash_forecast_snapshots`: mês, linha, valor previsto), gravado por job no dia 1.

### 5.5 Drawer de lançamentos

Aberto pela célula da tabela ou pela barra do gráfico.
- **Cabeçalho:** período (mês ou rótulo do período + tipo), linha (ou "Todas as movimentações"), **total** e texto explicativo das fontes.
- **Lista:** data · descrição · selo de origem · valor. Cada item clicável:

| Selo | Fonte | Clique abre |
|---|---|---|
| **Realizado** (verde) | `transactions` confirmadas (e baixas manuais de contas sem extrato) | Ficha da movimentação |
| **Previsto** (azul) | `installments` abertas | Ficha universal da parcela |
| **Projetado** (roxo) | Projeção virtual de recorrência (sem registro) | Ficha da recorrência, com a nota "ainda não existe como parcela" |

### 5.6 Regras da projeção

São as mesmas usadas pelo Dashboard (spec do Dashboard, seção 6). A implementação é **uma única função/view de projeção**, consumida por Dashboard, Caixa e Planejamento.

| Item | Como entra |
|---|---|
| Parcelas abertas | Na `scheduled_payment_date`; sem programação, no vencimento |
| Parcelas estimadas | Pelo valor estimado |
| Pagamentos vencidos | Como saída hoje |
| Recebimentos vencidos | Não entram (a menos que a chave esteja ligada) |
| Recorrências além da janela materializada | **Projeção virtual** pela regra vigente (`recurrence_versions`), sem criar registro |
| Cartão | A fatura em formação, pelo valor acumulado, no vencimento. Meses seguintes: assinaturas no cartão + parcelas de compras parceladas |
| Gateway | Recebimentos na conta do gateway; repasse projetado conforme `payout_rule` (transferência; sem efeito no consolidado) |
| Reserva | Fora do disponível. Aplicações e resgates **programados** entram em "Entre contas" |
| Realizado | `transactions` confirmadas + `pending_confirmation` (baixas manuais aguardando extrato contam como realizadas no fluxo, com marcação) |

---

## 6. Aba Extrato

### 6.1 Controles

- **Busca:** descrição original e interpretada, valor ("9800"), nome ou documento da contraparte.
- **Período:** Últimos 30 dias (padrão) · Este mês · Mês anterior · Personalizado.
- **Tipo:** Todas · Entradas · Saídas · Transferências.
- **Status:** Todos · Conciliadas · Pendentes · Ignoradas.
- **Origem:** Importada · Integração · Manual.
- **Conta:** pela faixa do topo. **Sem conta filtrada**, aparece o aviso: "Escolha uma conta na faixa acima para ver o saldo corrido e os pontos de conferência."

### 6.2 Tabela

**Agrupada por dia** (desc). O cabeçalho de cada dia mostra a data (+ "ontem"/"hoje") e, **com uma conta filtrada**, "Saldo no fim do dia R$ X".

| Coluna | Conteúdo |
|---|---|
| Data | Ponto de status (verde conciliada, âmbar pendente, cinza ignorada) + `dd/mm` |
| Descrição | **Linha 1:** descrição interpretada ("PIX recebido de APTO Incorporações"). **Linha 2:** descrição original do banco em fonte monoespaçada |
| Conta | |
| Vínculo | O que explica a movimentação: "APTO, mensalidade set/26" · "Transferência Asaas → Inter" · "Tarifa bancária". Pendente: "Pendente de conciliação" em âmbar. Ignorada: "Ignorada: {motivo}" |
| Entrada | Verde |
| Saída | |
| Saldo | **Saldo corrido**, só com uma única conta do disponível filtrada |

- **Ignoradas:** texto riscado e linha com opacidade reduzida. **Não entram no saldo.**
- **Ponto de conferência:** com uma conta filtrada, uma faixa no topo do dia mais recente (e nos dias de cada checkpoint) mostra:
  - verde: "Saldo do banco em dd/mm: R$ X. Confere com o sistema";
  - vermelho: "Saldo do banco em dd/mm: R$ X. Sistema: R$ Y. Diferença de R$ Z".
- **Rodapé:** "N movimentações" + Σ entradas e Σ saídas (sem ignoradas).
- **Clique na linha:** abre a ficha da movimentação (seção 9).

### 6.3 Descrição interpretada

`description_clean` é gerada na importação:
- identifica o tipo (PIX recebido, PIX enviado, TED, boleto pago, débito, tarifa, rendimento);
- identifica a contraparte pelo CPF/CNPJ (cruzando com `parties`) ou pelo nome no texto;
- monta uma frase curta.

A descrição original (`description_raw`) nunca é alterada.

---

## 7. Importar extrato

É um modal de 580px, em **3 passos** com barra de progresso.

### Passo 1 · Conta e arquivo
- Select da conta (bancos e cartões).
- Área de arrastar ou clicar: **OFX ou CSV**.
  - **CSV:** na primeira importação da conta, abre o mapeamento de colunas (data, descrição, valor ou débito/crédito, saldo opcional, separador decimal). O mapeamento fica salvo em `financial_accounts.csv_mapping`.
- "Continuar" só fica habilitado com o arquivo escolhido.

### Passo 2 · Prévia e conferência
- Nome do arquivo e **período coberto**.
- 4 números: **no arquivo · novas · já existentes** (deduplicadas por `external_id`/`fingerprint`) **· confirmam baixas** (fundem com baixas manuais `pending_confirmation`, regra 13.3 do documento-mãe).
- **Conferência de saldo:** quando o arquivo traz saldo final.
  - Verde: "Saldo final no arquivo em dd/mm: R$ X. Saldo calculado após a importação: R$ X". Se a importação resolve uma diferença aberta, a frase diz isso.
  - Vermelho: a diferença que permanece mesmo após a importação.
- **Lista das linhas do arquivo:** as já existentes aparecem esmaecidas com "Já existe".
- Botão: **"Importar N movimentações"**.

### Passo 3 · Resultado
- "N movimentações importadas no {conta}".
- Quantas foram **conciliadas automaticamente** (ID de gateway, correspondência exata se a conciliação automática estiver ligada), quantas foram **reconhecidas por regras** e quantas precisam de classificação.
- Estado da conferência de saldo.
- Botão: **"Ir para a conciliação"** (abre a aba filtrada pela conta).

### Registro e desfazer
- Cada importação gera um `statement_imports`, e cada movimentação importada aponta para ele (`import_id`).
- **Desfazer importação** (na ficha da conta, 10.3): disponível **enquanto nenhuma movimentação daquele arquivo tiver sido conciliada manualmente**. Conciliações automáticas são revertidas junto.
- Após desfazer, as movimentações são removidas e a conferência de saldo é recalculada.

---

## 8. Aba Conciliação

É uma **fila**. Cada movimentação pendente aparece com a melhor explicação encontrada, confirmável com um clique.

### 8.1 Indicadores (4 cartões)

| Cartão | Conteúdo |
|---|---|
| Pendentes | N · "X entradas, Y saídas" |
| Mais antiga | "há N dias" (âmbar se > 7) · conta e descrição |
| Conciliadas automaticamente, 7 dias | N · "Asaas e regras aprendidas" |
| **Fechamento de {mês anterior}** | "N pendências" (âmbar) ou "Liberado" (verde) · pendências do mês anterior que impedem o fechamento: movimentações pendentes com data no mês + baixas sem confirmação do mês + conferências com diferença |

### 8.2 Controles

- **Direção:** Todas · Entradas · Saídas. Conta pela faixa.
- **Botão principal "Conciliar as N correspondências exatas":** concilia de uma vez todas as pendentes com sugestão de nível **exato** (ID, ou valor + documento da contraparte, ou confirmação de baixa manual com mesmo valor e data). Só aparece se N > 0.

### 8.3 Cartão da fila

Tem duas colunas:
- **esquerda (banco):** data, conta, "há N dias", valor (verde para entrada), descrição original e, se for par de transferência, "Par: dd/mm, {conta}, + R$ X";
- **direita (explicação):** selo de nível, título da sugestão, detalhe, conteúdo específico do tipo (alternativas ou formulário) e ações.

Correspondências exatas têm **borda verde suave** e vêm primeiro na fila. As demais seguem por data desc.

### 8.4 Tipos de sugestão

| Tipo | Selo | Critério | Título / detalhe (exemplo) | Botão |
|---|---|---|---|---|
| ID do gateway | — | `external_id` da cobrança | Concilia automaticamente, **não entra na fila** | — |
| `exata` | Correspondência exata (verde) | Valor exato + CPF/CNPJ da contraparte = parcela aberta | "APTO, mensalidade set/26" · "Valor e CNPJ conferem. Pago 8 dias antes" | Conciliar |
| `confirma` | Correspondência exata (verde) | Mesmo valor e data (± 3 dias) de baixa manual `pending_confirmation` | "Confirma o recebimento registrado em 15/09" | Confirmar |
| `encargos` | Sugestão forte (azul) | Mesmo pagador, valor > parcela vencida, diferença ≤ encargos máximos | "Parcela de R$ 5.300 + R$ 82,10 de multa e juros" | Conciliar com encargos |
| `multi` | Sugestão forte | Mesmo pagador, valor = soma de 2+ parcelas abertas | "2 parcelas de Nuvem Pet: agosto e setembro" | Conciliar com as 2 |
| `parcial` | Sugestão forte | Mesmo pagador, valor < parcela | "Pagamento parcial. Saldo de R$ 3.000 segue em aberto" | Conciliar como parcial |
| `transf` | Transferência detectada (roxo) | Saída numa conta + entrada de mesmo valor em outra conta própria, ± 1 dia; ou repasse de gateway; ou pagamento de fatura | "Repasse Asaas → Inter" + par exibido | Registrar transferência (concilia os dois lados) |
| `regra` | Regra aprendida / Padrão do banco (roxo) | `categorization_rules` casou, ou padrão de texto do banco (tarifa, rendimento) | "Criar despesa: Posto Shell, Transporte" · "Regra confirmada 4 vezes" | Criar e conciliar / Lançar e conciliar |
| `media` | Sugestão (âmbar) | Valor e data compatíveis, sem documento da contraparte | "Qual lançamento este PIX paga?" + **alternativas em radio** (até 3 + "Nenhuma: é outra receita") | Conciliar com a escolhida |
| `classif` | Nada encontrado (vermelho) | Nenhuma correspondência | "Classifique esta entrada" + **formulário inline**: categoria · cliente/contraparte · checkbox **"Lembrar para as próximas deste CNPJ"** (marcado) | Classificar e conciliar |

**Pares de transferência:** o lado "espelho" (ex.: entrada no Inter do repasse) **não aparece como item separado** na fila. É exibido como "Par" no cartão do outro lado e conciliado junto.

### 8.5 Outras opções (expansível no cartão)

Quatro modos, selecionáveis:

| Modo | Conteúdo |
|---|---|
| **Buscar lançamento** | Lista de parcelas abertas da mesma direção (ordenadas por proximidade de valor e data, com busca), **seleção múltipla** com checkbox. Mostra a soma e a diferença: "Soma exata" (verde) · "Faltam R$ X" · "Passa em R$ X (vira pagamento parcial ou encargos)". Botão "Conciliar com as selecionadas" |
| **Criar lançamento** | Categoria · contraparte (· cliente/projeto se custo direto) → cria título liquidado e concilia |
| **É uma transferência** | Select da conta do outro lado → cria `transfers` (o outro lado fica aguardando a linha do extrato daquela conta) |
| **Ignorar** | Motivo obrigatório (duplicada pelo banco · estorno do próprio banco já pareado · teste · outro) |

### 8.6 Ao conciliar

1. Cria os `reconciliation_links` (N:N) com `method`: `auto`, `suggested`, `manual`, `rule` ou `bulk`.
2. Cria ou atualiza baixas conforme o tipo:
   - exata ou confirma → baixa total / fusão com a manual;
   - encargos → baixa com juros e multa;
   - multi → uma baixa por parcela;
   - parcial → baixa parcial;
   - regra ou classificação → título + parcela + baixa já liquidados.
3. **Classificar com "Lembrar"** cria uma `categorization_rule` (padrão de texto ou documento → categoria + contraparte), vinculada à conta.
4. Remove o item da fila e o adiciona a **"Conciliadas nesta sessão"**.
5. Toast descrevendo o que foi feito.

### 8.7 Baixas sem confirmação no extrato

É uma seção abaixo da fila. Lista as baixas manuais `pending_confirmation` **há mais de N dias** (padrão 7): descrição, quem registrou, quando, conta, "há N dias", valor.

| Ação | Efeito |
|---|---|
| **Procurar no extrato** | Vai para a aba Extrato filtrada pela conta e pelo valor |
| **Confirmar sem extrato** | Pede justificativa; marca a movimentação como confirmada; auditoria |
| **Estornar** | Estorna a baixa (motivo); a parcela volta a aberta |

Estado vazio: "Nenhuma baixa aguardando confirmação."

### 8.8 Conciliadas nesta sessão

Lista (data, vínculo, valor) com **Desfazer** em cada item: volta a movimentação (e o par) para a fila.

### 8.9 Estado vazio da fila

"Tudo conciliado neste filtro", mais a próxima importação sugerida (conta com extrato mais antigo). Se nenhuma conta usa extrato, a aba explica como ativar a importação e mostra só as baixas manuais.

### 8.10 Teclado

Com o foco na fila: `Enter` executa a ação principal do item focado · `↓`/`↑` navegam · `O` abre Outras opções · `I` abre Ignorar. Os listeners ficam **no container da fila, não globais**.

---

## 9. Ficha da movimentação

É um drawer de 540px.

- **Cabeçalho:**
  - conta;
  - descrição interpretada;
  - valor (verde se entrada);
  - status (Conciliada / Pendente de conciliação / Ignorada);
  - ações:
    - pendente: **Conciliar** (vai para a fila com o item aberto);
    - conciliada: **Desfazer conciliação**;
    - sempre: **Ignorar** / **Reativar**.
- **Dados do banco** (somente leitura para importadas e integradas):
  - data, descrição original, contraparte (documento), identificador do banco (`FITID` no OFX; ID no gateway) e origem (OFX / Integração Asaas / Manual).
  - Texto fixo: "Movimentações importadas não têm data, valor ou descrição editáveis. Só o vínculo e a classificação."
- **Vínculo:** baixas, títulos ou transferência ligados, com o valor de cada parte (N:N), clicáveis.
- **Como foi conciliada:** automática (ID) · sugestão aceita (nível) · regra aprendida · lote de exatas · manual. Com quem e quando.
- **Histórico** (auditoria).

**Desfazer conciliação:** a movimentação volta a pendente. **Se a conciliação criou um título** (tarifa, despesa, receita classificada), o sistema pergunta se ele deve ser estornado junto.

---

## 10. Ficha da conta financeira

É um drawer de 620px, aberto pelo ⋯ do cartão.

### 10.1 Cabeçalho
Tipo · nome · saldo (vermelho se negativo) · linha de estado (a mesma do cartão).

### 10.2 Corpo

| Seção | Conteúdo |
|---|---|
| **Saldo nos últimos 90 dias** | Gráfico de linha com área |
| **Conferência de saldo** | Lista de pontos: data · origem (OFX, Manual, Integração) · banco · sistema · resultado ("Confere" verde / "Diferença de R$ X" vermelho, com borda vermelha). Botão **"Informar saldo do banco"**: formulário inline (data + saldo) → "Conferir". Toast: "Saldo confere" ou "Diferença de R$ X registrada. O alerta fica ativo até ser resolvida" |
| **Configuração** (por tipo) | Banco: banco/agência/conta, compõe o disponível, confirma por extrato (formato), saldo inicial + data, integração ("estrutura pronta, disponível em breve"), conta padrão de quê. Gateway: provedor, liquidez por forma, regra de repasse, taxas automáticas. Reserva: tipo, fora do disponível, rendimento, aplicações/resgates, reserva mínima de caixa. Cartão: final, fechamento e vencimento, limite, conta de pagamento, fatura atual |
| **Importações** (contas com extrato) | Histórico: arquivo · período · novas/duplicadas · quando · **Desfazer** (habilitado só se permitido, seção 7) |
| **Regras de categorização aprendidas** | Padrão ("contém 'POSTO SHELL'") · categoria e contraparte · "usada N vezes". Ações editar/desativar |

Texto fixo sob Configuração: "Alterar o saldo inicial recalcula todos os saldos desde a data e fica na auditoria. Não é possível em período fechado."

### 10.3 Ações da conta
- Editar configuração (compõe disponível, confirma por extrato, dados bancários, regras de gateway e cartão).
- **Arquivar:** só com saldo zero; sai da faixa, e o histórico permanece.

### 10.4 Nova conta
Tipo → campos do tipo (10.2) + **saldo inicial e data** (obrigatórios) + compõe o disponível + confirma por extrato. Cartão: fechamento, vencimento, limite, conta de pagamento.

---

## 11. Nova movimentação e nova transferência

### 11.1 Nova movimentação
Para o que **não tem parcela**: tarifa, rendimento, gasto pago na hora.

- **Campos:** conta · tipo (entrada/saída) · categoria · descrição · data · valor.
- **Efeito:** cria **título + parcela + baixa já liquidados** (documento-mãe, 13.4) e a movimentação com origem `manual`.
- **Nota no modal:** "O sistema cria o título já liquidado, para que a movimentação apareça na DRE pela categoria."
- Em conta com extrato, a movimentação fica `pending_confirmation` até a linha do banco chegar.

### 11.2 Nova transferência
- **Campos:** de · para · data · valor · (tarifa opcional, que vira movimentação própria na origem, categoria "Tarifas bancárias").
- **Efeito:** `transfers` + par de movimentações. Sem impacto no resultado.
- **Nota contextual no modal:**
  - para a Reserva: "Aplicação na reserva: sai do disponível e aparece em 'Entre contas' no fluxo";
  - para o Cartão: "Pagamento de fatura: é transferência, porque as compras já entraram como despesa";
  - entre contas do disponível: "Com extrato, os dois lados serão confirmados na conciliação".
- **Validação:** contas diferentes; valor > 0.

---

## 12. Regras de negócio

| Situação | Regra |
|---|---|
| **Saldo** | Sempre calculado: saldo inicial + movimentações não ignoradas (confirmadas e `pending_confirmation`). Nunca digitado |
| **Baixa manual em conta com extrato** | Conta como realizada desde o registro (marcada "aguardando extrato"). A linha do extrato funde com ela (não duplica) |
| **Movimentação importada ou integrada** | Data, valor e descrição original não editáveis. Só vínculos e classificação |
| **Ignorar** | Motivo obrigatório; reversível; ignorada não entra no saldo |
| **Desfazer conciliação** | Volta a pendente. Títulos criados pela conciliação: pergunta se estorna |
| **Transferência** | Par ligado; sem impacto no resultado; no consolidado, só aparece se uma das contas estiver fora do disponível |
| **Transferência com tarifa** | Tarifa como movimentação própria na origem (resultado financeiro) |
| **Estorno do banco** (PIX devolvido) | Pareado com a movimentação original; a parcela que tinha sido baixada volta a aberta |
| **Gateway** | Recebimento concilia pelo ID; taxa lançada automaticamente; repasse = transferência |
| **Rendimento da reserva** | Resultado financeiro na conta da reserva; não afeta o disponível até o resgate |
| **Movimentação em período fechado** | Pode ser conciliada se o vínculo já existe. Criar título novo em mês fechado exige justificativa |
| **Diferença na conferência** | Alerta até resolver (nova conferência que bate) ou ajustar (lançamento de ajuste com justificativa) |
| **Fechamento do mês** | Exige zero movimentações pendentes com data no mês, zero baixas sem confirmação do mês e nenhuma conferência com diferença aberta nas contas com extrato |
| **Desfazer importação** | Só se nenhuma movimentação do arquivo tiver conciliação manual |
| **Saldo inicial** | Editável com aviso e auditoria; bloqueado se a data estiver em período fechado |

---

## 13. Automações

| Automação | Controle humano |
|---|---|
| Deduplicação na importação (`external_id` + `fingerprint`) | Resumo "já existentes" na prévia |
| Fusão de baixa manual com linha do extrato | Resumo "confirmam baixas" na prévia |
| Conciliação automática por ID de gateway | Marcada como automática na ficha |
| Correspondências exatas | **Não conciliam sozinhas por padrão**: ficam prontas para o botão em lote. Configurável para automático |
| Regras aprendidas | Criadas ao classificar com "Lembrar"; editáveis na ficha da conta |
| Detecção de transferências (mesmo valor, contas próprias, ± 1 dia) | Sugestão pareada |
| Padrões de texto do banco (tarifa, rendimento, pagamento de fatura) | Sugestão |
| Taxa do gateway | Lançada automaticamente |
| Conferência de saldo na importação OFX | Automática, com alerta |
| Descrição interpretada | Gerada na importação |
| Snapshot mensal da projeção (dia 1) | Base do "Comparar com o previsto" |
| **Alertas para o Dashboard** | Extrato desatualizado (I1), conciliação pendente (E7), baixa sem confirmação (E8), **saldo divergente (nova, 🟠)** |

---

## 14. Integrações e funcionamento independente

| Integração | Situação |
|---|---|
| **Recebimentos / Pagamentos** | A conciliação cria e confirma baixas nas parcelas deles; o fluxo lê as parcelas abertas |
| **Asaas** | Webhooks de pagamento, taxa e repasse via Edge Function |
| **Bancos** | Importação OFX/CSV agora. API bancária (Open Finance ou API do Inter) depois, **sem mudança de interface**: as movimentações passam a chegar com origem "Integração" |
| **Dashboard** | Saldo, projeção de 30 dias, fôlego e exceções |
| **Planejamento** | Usa a mesma função de projeção como base do forecast |

**Sem nenhuma conta com extrato:** Fluxo e Extrato funcionam com as baixas manuais como realizado. A Conciliação mostra como ativar a importação e só as baixas manuais. A conferência de saldo continua disponível pela opção manual "Informar saldo do banco".

---

## 15. Ajustes no modelo de dados (incluir no documento-mãe)

1. **`balance_checkpoints`:** `account_id`, `date`, `bank_balance`, `source` (`ofx`, `manual`, `integration`), `system_balance` (calculado na gravação), `difference`, `status` (`matched`, `open`, `adjusted`), `resolved_by`, `resolved_at`, `adjustment_transaction_id`.
2. **`statement_imports`:** `account_id`, `file_name`, `file_attachment_id`, `period_start`, `period_end`, `rows_total`, `rows_new`, `rows_duplicated`, `rows_confirming`, `imported_by`, `imported_at`, `status` (`active`, `undone`).
3. **Campos em `transactions`:** `description_raw`, `description_clean`, `counterparty_name`, `counterparty_document`, `import_id`, `bank_reference` (FITID/ID), `ignored_reason`, `ignored_by`, `ignored_at`.
4. **Campos em `financial_accounts`:** `bank_code`, `branch`, `account_number`, `nickname`, `liquidity_days` (jsonb por forma), `payout_rule`, `csv_mapping` (jsonb), `archived_at`.
5. **`categories.cash_flow_group`** (derivado do `impact_type`, sobrescrevível): `operating`, `investing`, `financing`, `internal`. Mais **`cash_flow_line`** para as linhas operacionais (recebimentos, outras receitas, equipe, custos diretos, estrutura, impostos, cartão, financeiro).
6. **`reconciliation_links.method`:** acrescentar `rule` e `bulk`.
7. **`categorization_rules`:** `account_id` (opcional), `match_type` (`text_contains`, `document`), `pattern`, `category_id`, `party_id`, `times_used`, `active`, `created_from_transaction_id`.
8. **`installments.expected_account_id`:** conta prevista, para o fluxo por conta.
9. **`cash_forecast_snapshots`:** `month`, `cash_flow_line`, `account_id` (nulo = consolidado), `forecast_amount`, `taken_at`.

---

## 16. Parâmetros configuráveis

| Parâmetro | Padrão |
|---|---|
| Reserva mínima de caixa | R$ 30.000 (definido pela empresa) |
| Dias sem extrato para aviso | 7 |
| Dias para baixa sem confirmação | 7 |
| Tolerância de data para sugestões | ± 3 dias (transferências: ± 1 dia) |
| Conciliar correspondências exatas automaticamente | Não (botão em lote) |
| Meses de passado no gráfico mensal | 6 |
| Conta padrão por direção (para parcelas sem conta prevista) | Recebimentos: Asaas · Pagamentos: Inter |
| Tolerância da conferência de saldo | R$ 0,01 |

---

## 17. Permissões e auditoria

- A página é acessível a diretoria e perfis do Financeiro.
- Valores de pessoal no drawer de lançamentos respeitam `view_compensation` (sem a permissão: "Folha, valor restrito").
- **Auditoria obrigatória em:**
  - importação e desfazer importação;
  - conciliação e desfazer (com método);
  - ignorar e reativar;
  - confirmar sem extrato (com justificativa);
  - lançamento de ajuste de conferência;
  - criação, edição e arquivamento de conta;
  - alteração de saldo inicial;
  - criação e edição de regras de categorização;
  - transferências.

---

## 18. Casos de borda

- **OFX sem saldo final:** a importação funciona; a conferência fica "não informada" e a ficha sugere "Informar saldo do banco".
- **Arquivo de conta errada:** o sistema compara a agência e a conta do OFX com a conta escolhida e bloqueia se divergirem. No CSV, avisa se nenhuma linha casar com o histórico.
- **Período do arquivo sobreposto a importação anterior:** deduplicação resolve. A prévia mostra as "já existentes".
- **Mesmo valor pago por dois clientes no mesmo dia sem documento:** sugestão de nível médio com as alternativas; nunca concilia sozinha.
- **PIX que paga parcela de outro mês de competência:** concilia normalmente; a competência é da parcela, a data do caixa é da movimentação.
- **Repasse do gateway com taxa descontada:** a diferença entre o repasse e a soma dos recebimentos vira sugestão de taxa.
- **Transferência cujo outro lado ainda não chegou** (extrato da outra conta não importado): a transferência fica com um lado conciliado e o outro "aguardando extrato".
- **Conta arquivada com movimentações antigas:** aparece no Extrato e no Fluxo histórico, não na faixa.
- **Movimentação ignorada que depois se revela real:** "Reativar" devolve à fila e recalcula o saldo.
- **Diferença de conferência causada por movimentação de mês fechado:** o ajuste exige justificativa de período fechado.
- **Horizonte de 12 meses com recorrência encerrando no meio:** a projeção virtual respeita `end_date` e as versões futuras de valor.
- **Cartão com fatura importada contendo compra já lançada:** dedupe por estabelecimento + valor ± 5% + data ± 3 dias (spec de Pagamentos, 6.6).

---

## 19. Fora do escopo desta versão

- Integração bancária por API (Open Finance / API do Inter).
- Sugestão por IA para movimentações sem regra.
- Análise de erro de previsão com aprendizado (além da linha de comparação).
- Pipeline comercial na projeção (Planejamento).
- Cenários de fluxo (Planejamento).
- Múltiplas moedas.
