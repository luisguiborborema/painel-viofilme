# Viofilme ERP — Financeiro
## Página 3: Pagamentos

**Versão:** 1.0 · setembro/2026
**Público:** desenvolvimento (Gui)
**Documento-mãe:** `viofilme_financeiro_regras_gerais.md`. Em caso de conflito, o documento-mãe prevalece.
**Specs relacionadas:** `viofilme_financeiro_dashboard_spec.md` (exceções que apontam para cá) e `viofilme_financeiro_recebimentos_spec.md`. Pagamentos reaproveita os mesmos componentes: ficha universal, modal de baixa, drawer de cadastro com prévia, barra de lote, versões de recorrência e auditoria.
**Mockup de referência:** https://claude.ai/artifact/EjgMQAwCTKY4QYXbVkcgjK (dados fictícios).

---

## Sumário

1. Objetivo
2. Conceitos novos desta página
3. Estrutura da página
4. Faixa de indicadores
5. Aba Contas a pagar
6. Modo fatura (cartão de crédito)
7. Ficha da conta a pagar
8. Registrar pagamento
9. Informar valor real
10. Nova despesa (cadastro)
11. Aba Folha
12. Aba Recorrências
13. Aba Fornecedores
14. Aprovação
15. Reembolso a colaborador
16. Impostos e obrigações
17. Regras de negócio
18. Automações
19. Integrações e funcionamento independente
20. Ajustes no modelo de dados (incluir no documento-mãe)
21. Parâmetros configuráveis
22. Permissões e auditoria
23. Casos de borda
24. Fora do escopo desta versão

---

## 1. Objetivo

Pagamentos é **o lugar de todo dinheiro que sai**.

O modelo é o mesmo de Recebimentos: um título com `direction = out`. A experiência é diferente, porque o trabalho é diferente:

- **Em Recebimentos, o trabalho é cobrar.** Régua, promessa, inadimplência.
- **Em Pagamentos, o trabalho é não esquecer, não pagar errado e entender o custo.** Programar, ter os dados de pagamento à mão, guardar os documentos, classificar bem.

| Aba | Pergunta | Objeto principal |
|---|---|---|
| **Contas a pagar** | O que tenho que pagar, quando e com quê? | Parcela `out` |
| **Folha** | Quanto custa a equipe e o ciclo do mês está em dia? | Títulos de pessoal do mês, por colaborador |
| **Recorrências** | Quais são os custos fixos e como evoluem? | Recorrência `out` (exceto equipe) |
| **Fornecedores** | Com quem gasto e quanto? | `parties` com papel fornecedor, freelancer ou órgão público |

**Decisões de estrutura e o motivo de cada uma:**
- **Impostos não têm aba.** São contas com valor estimado (seção 2.1) + chip de filtro + exceção no Dashboard.
- **Aprovação não tem aba.** É uma visão que aparece quando a regra está ligada (seção 14).
- **Cartão não tem aba.** É um modo de visualização da lista (seção 6).
- **Folha tem aba.** É o maior custo da empresa e um ritual mensal com etapas próprias (seção 11).

---

## 2. Conceitos novos desta página

Estes conceitos valem para o módulo inteiro e entram no documento-mãe.

### 2.1 Valor estimado vs. confirmado

**O problema:** muitas contas se repetem com valor que só se conhece perto do vencimento (DAS, energia, INSS, fatura). Sem o valor, a projeção de caixa mente. Exigindo o valor exato, a conta só é lançada tarde.

**Como funciona:**
- Toda parcela tem `amount_status`: `estimated` | `confirmed`.
- A recorrência define `estimation_method`:
  - `fixed`: valor fixo;
  - `last`: último valor pago;
  - `avg3`: média dos 3 últimos pagos;
  - `revenue_pct`: % da receita bruta de um mês de referência (impostos).
- Parcela estimada exibe o selo **"~ Estimada"**, com o valor em itálico, cinza e com "~" na frente. **Entra normalmente na projeção de caixa e na DRE** pelo valor estimado.
- A ação **"Informar valor real"** confirma o valor (seção 9). O valor estimado original fica no histórico.

### 2.2 Dados de pagamento na conta

- Cada parcela guarda **como pagar** (`payment_details`): método, linha digitável, chave PIX (tipo + valor), dados bancários e favorecido lido do documento.
- O fornecedor guarda os **dados padrão**, e toda conta nova herda esses dados.
- Na lista e na ficha, o botão **Copiar** leva o código para o clipboard.
- **Por quê:** enquanto não existe pagamento integrado ao banco, o fluxo real é copiar → pagar no app → marcar como paga com comprovante. Esse ciclo precisa levar segundos.

### 2.3 Documentos esperados

Cada conta tem três espaços de documento: **Boleto ou fatura**, **NF do fornecedor** e **Comprovante**.

- `attachments.kind`: `boleto`, `invoice_nf`, `receipt`, `contract`, `other`.
- Regras por categoria:
  - `requires_invoice` (exigir NF antes de pagar): **padrão ligado** em Freelancers e Serviços de terceiros;
  - `requires_receipt` (exigir comprovante): padrão desligado.

---

## 3. Estrutura da página

```
Cabeçalho: "Pagamentos" + subtítulo      [Lançar de arquivo] [Importar CSV] [+ Nova despesa]
Faixa de indicadores (4 cards)
Abas: Contas a pagar · Folha (badge "N NFs pendentes") · Recorrências · Fornecedores
```

**Overlays da página:**
- ficha da conta (600px, expansível);
- ficha do colaborador (620px);
- ficha do fornecedor (620px);
- ficha da recorrência (600px);
- nova despesa (940px);
- modais: registrar pagamento, informar valor real, ajustes da folha;
- barra de lote;
- toast.

**Botão "Lançar de arquivo":** abre Nova despesa com a área de leitura de documento em destaque (seção 10.1).

---

## 4. Faixa de indicadores

| Card | Número | Contexto | Clique |
|---|---|---|---|
| **A pagar no mês** | Σ saldo de parcelas `out` não vencidas com vencimento no mês | "N contas, M sem programação, K estimadas" | Contas › Em aberto |
| **Pago no mês** | Σ principal baixado no mês + barra | "X% de R$ Y previstos" | Contas › Pagas |
| **Vencido** | Σ saldo vencido (qualquer mês) | Quantidade + fornecedores | Contas › Vencidas |
| **Próximos 7 dias** | Σ saldo de hoje a hoje+7 | **Cobertura pelo saldo** (6.1) | Contas › Em aberto |

### 4.1 Cobertura dos próximos 7 dias

Para cada conta de saída, o sistema compara o saldo projetado no dia de cada pagamento (saldo atual + entradas previstas − saídas previstas até a data) com o valor a pagar.

- **Tudo coberto:** ✓ verde, "Saldo disponível de R$ X cobre".
- **Alguma data descoberta:** ✕ vermelho, "Faltam R$ X no {conta} em dd/mm".
- A projeção usa a mesma regra do Dashboard: recebimentos vencidos não entram.

---

## 5. Aba Contas a pagar

A unidade é a **parcela `out`**.

### 5.1 Visões

**Em aberto** (padrão) · **Vencidas** · **Pagas** · **Todas** · **A aprovar** (só com a regra de aprovação ligada).

Ordenação:
- Em aberto: vencidas primeiro, depois por data efetiva (programação ou vencimento).
- Pagas: data do pagamento desc.

### 5.2 Barra de controle

- **Mês:** `‹ Setembro 2026 ›`, com base Vencimento/Competência (igual a Recebimentos).
- **Agrupar:** Nenhum · Por categoria (grupo de primeiro nível) · Por forma de pagamento.
  - Grupos mostram o cabeçalho com a quantidade e o subtotal.
  - **Por quê aqui e não em Recebimentos:** em despesas, é natural ver "tudo que é Custos diretos" ou "tudo que sai no cartão" como bloco.
- **Busca:** fornecedor, descrição, valor, número da NF.
- **Chips rápidos** (com contador):

| Chip | Filtra | Observação |
|---|---|---|
| Sem programação | Abertas, sem `scheduled_payment_date`, não débito automático | Destino da exceção E4/programação do Dashboard |
| Estimadas | `amount_status = estimated` | |
| Sem dados de pagamento | Abertas sem `payment_details` e não débito automático | |
| Sem comprovante | Pagas sem anexo `receipt` | Muda a visão para Pagas |
| Impostos e obrigações | Categorias do grupo Impostos | |
| **Cartões** | Liga o **modo fatura** (seção 6) | |

- **Mais filtros:** fornecedor, categoria, cliente/projeto, conta de saída, centro de custo.

### 5.3 Tabela

| Coluna | Conteúdo |
|---|---|
| ☐ | Seleção. Desabilitada nas linhas especiais (folha, fatura) |
| Vencimento | `dd/mm` + linha "hoje", "em N dias", "há N dias" (vermelho) ou "Paga em dd/mm" |
| Fornecedor | Nome. Clique abre a ficha do fornecedor |
| Descrição e categoria | Linha 1: descrição + ↻ se recorrência + selo "2/3" se parcelada. Linha 2: categoria + **chip do cliente/projeto** quando é custo direto. Clique abre a ficha |
| Situação | Chip de situação (5.4) + linha de pagamento (5.5) |
| Valor | Saldo. Estimada: "~ R$ X" em itálico. Linha auxiliar: método de estimativa, parcela, "pago em dd/mm" |
| Ação | Ícone **Copiar código** (se houver dados) + botão contextual (5.6) + menu ⋯ |

Colunas opcionais: centro de custo, conta de saída, forma, competência, origem.

**Rodapé:** "N contas neste filtro" + Total · Em aberto · Pago · Vencido.

### 5.4 Chip de situação

Calculado em ordem de prioridade:

| Chip | Condição |
|---|---|
| Paga (verde) | `settled` |
| Vencida há N dias (vermelho) | Saldo > 0 e vencimento < hoje |
| Aguardando aprovação (roxo) | Regra de aprovação ligada e pendente |
| ~ Estimada (cinza) | `amount_status = estimated` |
| Programada para dd/mm (azul) | Tem data programada |
| Vence hoje / Vence em N dias (âmbar) | Até 7 dias |
| A vencer (cinza) | Mais de 7 dias |
| Parcial (âmbar) | Com baixa parcial |
| Em formação (roxo) | Só a linha da fatura do cartão antes do fechamento |

### 5.5 Linha de pagamento

| Texto | Cor | Condição |
|---|---|---|
| Boleto, código salvo / PIX, chave do fornecedor / Guia DAS, código salvo | Cinza | Tem `payment_details` |
| Débito automático | Cinza | Forma débito automático |
| Guia ainda não emitida | Âmbar | Estimada sem código |
| Sem dados de pagamento | Âmbar | Sem `payment_details` |
| Boleto, favorecido diferente | Vermelho | Favorecido lido ≠ fornecedor (7.3) |
| NF pendente, exigida para pagar | Âmbar | Categoria exige NF e não há NF anexada (tem prioridade sobre as demais) |
| Comprovante anexado / Sem comprovante | Verde / âmbar | Parcela paga |

### 5.6 Ação contextual por linha

| Situação | Botão |
|---|---|
| Linha da folha | **Abrir folha** (vai para a aba Folha) |
| Linha da fatura | **Ver fatura** (liga o modo fatura) |
| Aguardando aprovação | **Aprovar** |
| Estimada | **Informar valor** |
| Débito automático | **Confirmar débito** |
| Aberta | **Pagar** |
| Paga | **Comprovante** |

**Menu ⋯:** Programar · Alterar vencimento · Informar valor real · Anexar documento · Duplicar · Cancelar.

### 5.7 Linhas especiais

- **Folha do mês:** uma linha por competência (ex.: "Folha de setembro, 11 pagamentos"). Mostra o total a pagar e o status agregado ("7 de 9 NFs recebidas" ou "Todos os comprovantes anexados"). O clique leva à aba Folha. **Não é selecionável** na lista.
  - Com a permissão `view_compensation` ausente, a linha mostra "Equipe, valor restrito", e os totais da página incluem o valor sem revelá-lo por pessoa.
- **Fatura do cartão:** uma linha por fatura no mês de vencimento, com o valor somado das compras do ciclo e o chip "Em formação" até o fechamento. O clique liga o modo fatura. **Não é selecionável.**

### 5.8 Ações em lote

| Ação | Regra |
|---|---|
| **Programar para…** | Data única. Antes de confirmar, mostra o saldo projetado da conta de saída na data |
| **Registrar pagamento** | **Permitido com fornecedores diferentes** ("paguei tudo de hoje"). Tela de confirmação com uma linha por conta (valor, conta e comprovante editáveis). **Ficam de fora automaticamente:** estimadas e contas com NF exigida ausente, com aviso "N ficaram de fora" |
| **Aprovar** | Só com a regra ligada |
| **Alterar vencimento / Exportar / Cancelar** | Como em Recebimentos |

---

## 6. Modo fatura (cartão de crédito)

É ativado pelo chip **Cartões** ou pelo clique na linha da fatura. Substitui a tabela da aba pela visão do cartão.

### 6.1 Modelo contábil do cartão (regra central)

- O cartão é uma `financial_account` do tipo `credit_card`, com `closing_day`, `due_day`, `last_digits`, `limit` e conta de pagamento padrão.
- **Cada compra é uma despesa** com forma "cartão", **liquidada na data da compra** contra a conta do cartão. O saldo do cartão fica negativo, representando a dívida.
- **Competência = data da compra.** O gasto entra na DRE no mês em que aconteceu.
- **A fatura NÃO é despesa.** Pagar a fatura é uma **transferência** da conta bancária para o cartão.
  - **Por quê:** se a fatura fosse despesa, cada compra seria contada duas vezes.
- **Compra parcelada no cartão:** o valor total vai para a competência da compra (padrão, editável). As parcelas distribuem o valor nas faturas seguintes, para fins de caixa.
- **A fatura é derivada** das compras do ciclo (não é um registro digitado) e entra na projeção de caixa pelo valor já acumulado.

### 6.2 Cabeçalho do cartão

Seletor de cartão (se houver mais de um) com:
- nome, final, dia de fechamento e vencimento, conta de pagamento;
- abas **Fatura atual · Próxima · Anteriores**;
- total da fatura + texto do ciclo ("Ciclo de 19/08 a 18/09. Fecha amanhã, vence em 25/09");
- barra de limite usado;
- ações:
  - **Lançar compra:** abre Nova despesa com a forma cartão;
  - **Importar fatura para conferir:** OFX/CSV;
  - **Pagar fatura:** registra a transferência. Aparece só na fatura atual e ainda não paga.

**Painel "No que foi":** barras horizontais com o total por grupo de categoria, ordenado desc. "Sem classificação" aparece em âmbar.

### 6.3 Compras sem classificação

Compras vindas da importação que não casaram com um lançamento aparecem num bloco âmbar acima da lista:
- data, descrição original do extrato (fonte monoespaçada), **categoria sugerida**, valor e botão **Confirmar**;
- confirmar aplica a categoria e cria/atualiza a `categorization_rule` para esse estabelecimento: "Próximas compras de X serão classificadas sozinhas".

### 6.4 Lista de compras

Colunas: data · compra (+ selo **↻ assinatura** para recorrências no cartão, + selo "2/3" para parcelas) · categoria (investimentos em azul) · cliente/projeto · valor. O clique abre a ficha universal da compra, com a leitura do custo.

### 6.5 Abas

- **Próxima:** compras já compromissadas (assinaturas previstas + parcelas futuras). Valores projetados, somente leitura.
- **Anteriores:** faturas fechadas, com total, data e forma de pagamento, e o resumo por categoria.

### 6.6 Assinaturas no cartão

São recorrências com forma "cartão". Todo ciclo, a compra é gerada sozinha dentro da fatura. A importação da fatura **confirma** a compra gerada, sem criar outra (dedupe por estabelecimento + valor ± 5% + data ± 3 dias).

---

## 7. Ficha da conta a pagar

É a ficha universal (documento-mãe, seção 22), 600px e expansível.

### 7.1 Cabeçalho

1. Tipo ("Conta a pagar" ou "Conta a pagar, investimento") · Expandir · Fechar.
2. **Fornecedor** (link para a ficha) + descrição.
3. **Valor:**
   - estimada: "~ R$ X", com a linha "Estimado: {método}";
   - vencida: "Vencida há N dias. Encargos, se houver, são informados no pagamento";
   - paga: "Pago em dd/mm".
4. Chips: situação + linha de pagamento.
5. **Origem clicável:**
   - "Gerada pela recorrência X" → ficha da recorrência;
   - "Veio da Operação, solicitação de freelancer nº 214";
   - "Lido do boleto enviado em dd/mm";
   - "Parcelada em 3x";
   - "Criada manualmente".
6. **Ações:**
   - principal, conforme a situação: **Registrar pagamento** · **Informar valor real** (estimada) · **Confirmar débito** (débito automático);
   - secundária: **Programar**;
   - paga: **Ver comprovante**;
   - sempre: **Editar** + ⋯ (Alterar vencimento, Informar valor real, Duplicar, Cancelar, Estornar pagamento).

### 7.2 Corpo, na ordem

| Seção | Conteúdo |
|---|---|
| **Dados de pagamento** (primeiro no corpo) | Uma linha por dado: rótulo · valor em fonte monoespaçada · **Copiar**. Boleto: linha digitável + valor. PIX: chave + favorecido. Transferência: banco, agência, conta, documento. Sem dados: faixa âmbar com "Adicionar dados" (ou "Informar valor real" se estimada sem guia) |
| **Resumo** (grid 3 colunas) | Vencimento · Programada para (âmbar se "Não programada") · Competência · Conta de saída · Forma · Parcela |
| **Itens e rateio** | Uma linha por item: categoria + centro de custo + cliente/projeto (ou "Operação geral") + colaborador (se pessoal) + valor |
| **Leitura do custo** (7.4) | |
| **Documentos** | Três espaços clicáveis: Boleto/cobrança · NF · Comprovante. Anexado = contorno sólido verde; pendente = tracejado; **obrigatório** = tracejado âmbar com "Obrigatório antes de pagar" |
| **Pagamentos** | Baixas com data, forma, conta, valor, encargos/desconto e conciliação |
| **Histórico** | Auditoria completa |

### 7.3 Favorecido divergente

Quando o favorecido extraído do boleto/PIX não corresponde ao CPF/CNPJ do fornecedor (nome ou documento):
- aparece um alerta vermelho abaixo dos dados de pagamento: "Favorecido diferente do fornecedor. O boleto está em nome de X, e o fornecedor cadastrado é Y. Confirme com o fornecedor antes de pagar.";
- a linha na lista mostra "Boleto, favorecido diferente";
- ao copiar o código, o toast repete o aviso;
- **não bloqueia** (há casos legítimos: intermediadoras de pagamento), mas fica registrado na auditoria quem pagou mesmo assim.

### 7.4 Leitura do custo

Responde "onde esse dinheiro aparece e se ele está normal". Fica em fundo destacado:

| Linha | Conteúdo |
|---|---|
| **Na DRE** | Caminho exato ("Despesas operacionais › Softwares › Criação"). Investimento: "Fora da DRE: Investimentos do período". Transferência de fatura: "Não é despesa" |
| **No orçamento** | "R$ X de R$ Y no mês (Z%)" + barra. Âmbar acima de 100%; texto "acima da tolerância" acima do parâmetro |
| **Na rentabilidade** | Custo direto: "Custo direto de {cliente}: reduz a margem de contribuição em R$ X". Estrutura: "Despesa de estrutura, não é distribuída entre clientes". Dedução: "Distribuído pela alíquota efetiva". Investimento: "Não afeta" |
| **Histórico** | Mini gráfico dos últimos 6 valores comparáveis (mesma recorrência ou mesmo fornecedor + categoria), com o atual destacado + frase ("Estável: variação de até X%", "Maior valor dos últimos 6 meses" em âmbar, "+X% vs. mesmo mês do ano anterior"). Sem histórico: "Sem histórico comparável" |
| **Mesma categoria** | Até 4 outros lançamentos da categoria no mês (clicáveis) + total da categoria no mês |

---

## 8. Registrar pagamento

É um modal de 500px.

| Campo | Padrão |
|---|---|
| Data | Hoje; ou a data programada, se anterior a hoje |
| Valor pago | Saldo |
| Conta de saída | A programada; senão, a padrão do fornecedor; senão, a principal |
| Comprovante | **Área de arrastar em destaque** (não escondida) |

**Comportamentos:**
- **Conta vencida:** aparecem os campos **Juros pagos** e **Multa paga**, vazios. O sistema **não calcula**, porque os encargos são do fornecedor. Os valores informados vão para resultado financeiro.
- **Valor menor que o saldo:** escolha obrigatória:
  - "Manter R$ X em aberto (pagamento parcial)";
  - "**Desconto obtido** de R$ X e quitar": vira receita financeira; **a categoria original fica com o valor cheio.**
- **Valor maior que o saldo:** a diferença vai para encargos pagos, com confirmação.
- **NF exigida e ausente:** bloco âmbar "Esta categoria exige NF antes do pagamento", com **"Anexar NF agora"** ou **justificativa obrigatória** ("NF será enviada até sexta"). A conta fica marcada com NF pendente.
- **Categoria exige comprovante:** o anexo é obrigatório para confirmar.
- **Saldo insuficiente na conta** (pelo saldo calculado): aviso âmbar, sem bloquear.

**Ao confirmar:**
1. cria a baixa;
2. cria a movimentação (`pending_confirmation` em conta com extrato);
3. anexa o comprovante;
4. grava a justificativa de NF, se houver;
5. registra a auditoria;
6. toast: "Pagamento registrado: {fornecedor}, R$ X, com/sem comprovante. Aguardando confirmação no extrato {conta}."

---

## 9. Informar valor real

É um modal de 460px, para parcelas estimadas.

- **Contexto:** fornecedor, descrição, vencimento, e o bloco "Estimado ({método}): R$ X".
- **Campos:** valor da guia ou conta · linha digitável/código de barras.
- **"Anexar a guia":** lê o documento (mesma Edge Function da seção 10.1) e preenche valor e código.
- **Diferença calculada ao vivo:** "Diferença de +X% em relação ao estimado". Acima de 20% (parâmetro), âmbar + "Vale revisar o método de estimativa da recorrência".
- **Ao confirmar:**
  - `amount_status = confirmed`;
  - valor atualizado;
  - `payment_details` preenchido;
  - guia anexada como `boleto`;
  - o valor estimado original vai para o histórico;
  - a projeção de caixa é recalculada.

---

## 10. Nova despesa (cadastro)

É um drawer de 940px com **formulário à esquerda e prévia viva à direita (340px)**. É o mesmo esqueleto de Nova receita.

### 10.1 Lançar a partir de arquivo (topo do formulário)

Área clicável e de arrastar: **"Arraste o boleto, a NF ou a fatura"**.

- Uma **Edge Function** envia o PDF ou imagem à API do Claude e extrai: CNPJ do emissor, razão social, valor, vencimento, linha digitável, favorecido, número da NF e descrição.
- O CNPJ encontra o fornecedor e aplica os padrões dele. Se não existir, abre o cadastro rápido com os dados lidos.
- Os campos preenchidos pela leitura mostram o selo **"lido do documento"** até serem editados ou o registro ser salvo.
- O arquivo vai direto para os anexos, no espaço correto (boleto ou NF).
- Após a leitura, a área muda para o estado "Documento lido: {arquivo}", com borda na cor de destaque.
- **Falha na leitura:** preenchimento manual, com o arquivo anexado mesmo assim.
- **Proteção contra duplicidade:** linha digitável já existente → **bloqueio** ("Este boleto já está cadastrado em {conta}").

### 10.2 Tipo

Única ("Um vencimento") · Parcelada ("Compra em parcelas") · Recorrente ("Custo fixo, assinatura").

### 10.3 Fornecedor

- Select com busca. Ao escolher, aplica os padrões: categoria, centro de custo, forma de pagamento, dados de pagamento, conta de saída. O texto "Padrões do fornecedor aplicados: …" confirma.
- **+ Cadastrar novo fornecedor:** cadastro rápido com CNPJ/CPF (preenchimento automático), tipo (Fornecedor, Freelancer, Órgão público) e chave PIX.
- **Descrição:** sugerida pelo fornecedor e pela categoria.

### 10.4 Itens e rateio

Uma linha por item: **Categoria** · **Cliente ou projeto** · **Valor** · remover. Abaixo de cada linha, uma **dica dinâmica**:

| Situação | Dica |
|---|---|
| Custo direto sem cliente | "Custo direto: escolha o cliente ou projeto (ou Operação geral)" — âmbar, com a borda do campo em âmbar |
| Custo direto com cliente | "Entra como custo direto de {cliente}" |
| Investimento | "Investimento: fica fora da DRE, aparece em Investimentos" |
| Estrutura | "Despesa de estrutura, centro de custo sugerido: {cc}" |

- **Colaborador** aparece como coluna só para categorias de pessoal.
- **"Dividir entre clientes":** cria um item por cliente selecionado, em partes iguais ou por %, mantendo a categoria.
- **Centro de custo:** sugerido pela categoria (custo direto → Entrega), editável em Mais detalhes.
- **"+ Adicionar item"** e **Total**.

### 10.5 Pagamento

- **Forma:** Boleto · PIX · Transferência · **Cartão de crédito** · Débito automático · Dinheiro.
- **Forma diferente de cartão:**
  - conta de saída;
  - vencimento;
  - competência (automática, com "alterar");
  - **programar para** (opcional);
  - linha digitável ou chave PIX (herdada do fornecedor).
- **Forma cartão:**
  - **o vencimento some**;
  - aparecem **cartão**, **data da compra** e **parcelas no cartão** (à vista, 2x, 3x…);
  - a prévia mostra em qual fatura cada parcela entra.
- **Recorrente:** **Valor** fixo / estimado por média de 3 meses / último valor / % da receita, e término.
- **Parcelada:** número de parcelas; competência "Toda no mês da compra" (padrão) ou "Uma por parcela".

### 10.6 Documentos

Espaços Boleto e NF. Quando a categoria exige NF, o espaço fica em âmbar com "exigida para pagar".

### 10.7 Mais detalhes

- **Pago por colaborador (reembolso):** seção 15.
- Centro de custo · Número da NF · Observação.

### 10.8 Prévia viva

- **Título e subtítulo:**
  - "Uma conta a pagar";
  - "N parcelas de R$ X";
  - "Custo recorrente de (~) R$ X por mês" + "Custo fixo mensal sobe R$ X";
  - "Compra no cartão Inter, R$ X em Nx".
- **Parcelas:** vencimento (ou "Fatura que vence em…"), competência, valor. Parcelas futuras de recorrência aparecem tracejadas; estimadas levam "~".
- **Impacto:**
  - **Orçamento:** "Orçamento, {grupo}: X% → Y%", com barra em duas cores (já realizado em cinza + este lançamento na cor de destaque, âmbar se passar da tolerância);
  - **Rentabilidade:** "custo direto de {cliente} em {mês}";
  - **Investimento:** "não entra no resultado";
  - **Caixa:** "Sai do {conta} em dd/mm. Saldo projetado nesse dia: R$ X". Para cartão: "entra na fatura; a fatura é paga por transferência, sem contar a despesa de novo";
  - "Esta categoria exige NF antes do pagamento";
  - reembolso.
- **"Para salvar, falta:"** fornecedor · valor · cliente/projeto do custo direto.

### 10.9 Rodapé

| Botão | Efeito |
|---|---|
| Salvar e criar outra | Salva e reabre mantendo o fornecedor |
| **Salvar e marcar como paga** | Salva com baixa na data de hoje (para compras já pagas) |
| **Salvar** (principal) | Salva em aberto |

Compra no cartão: salva direto na fatura do ciclo correspondente e abre o modo fatura.

---

## 11. Aba Folha

### 11.1 Premissa: equipe PJ é colaborador, não fornecedor

A equipe fixa da Viofilme é contratada como PJ, mas **gerencialmente é mão de obra**, não serviço de terceiros.

**Por quê:**
1. O rateio de equipe depende de capacidade e carteira de cada pessoa.
2. A DRE precisa separar "custo da equipe" de "serviços de terceiros".
3. O ranking de fornecedores ficaria dominado pela equipe.
4. A remuneração precisa de permissão própria.

**Três tipos de quem recebe:**

| Tipo | Quem | Onde vive |
|---|---|---|
| **Colaborador** (`team_member`) | Equipe fixa. `contract_type`: `pj` (hoje), `clt`, `intern`, `partner` | Aba Folha |
| **Freelancer** | Trabalho pontual, por job, vinculado a cliente/projeto | Contas a pagar + Fornecedores |
| **Fornecedor / Órgão público** | Empresas, softwares, estrutura, impostos | Contas a pagar + Fornecedores |

**Visibilidade:** a aba Folha só aparece com a permissão `view_compensation`.

### 11.2 Cabeçalho

- "Folha de {mês} de {ano}" + "Competência {mês}, pagamento em dd/mm" (dia de pagamento padrão da equipe).
- Ações:
  - **Solicitar NFs pendentes** (11.6);
  - **Pagar quem tem NF** (principal).

### 11.3 Indicadores (4 cards)

| Card | Cálculo |
|---|---|
| **Custo da equipe no mês** | Σ (contrato + ajustes de custo) dos colaboradores, **sem sócios, reembolsos e adiantamentos**. Contexto: "Com pró-labore: R$ X. {mês anterior}: R$ Y" |
| **Mão de obra sobre a receita líquida** | Custo da equipe ÷ receita líquida do mês (competência). Contexto: mês anterior + referência configurável ("saudável até 40%") |
| **NFs recebidas** | "N de M" (colaboradores PJ). Âmbar se incompleto. Contexto: nomes pendentes |
| **Pagos** | "N de M" (incluindo sócios). Contexto: data e conta |

### 11.4 Etapas do ciclo

Quatro cartões, **derivados dos dados** e nunca marcados manualmente:
1. **Valores conferidos** (contratos e ajustes do mês);
2. **NFs recebidas** (N de M);
3. **Pagamentos feitos** (N de M);
4. **Comprovantes anexados** (N de M).

Concluída = círculo verde com ✓ e borda verde.

### 11.5 Tabela

Agrupada por centro de custo (**Entrega · Comercial · Administrativo · Sócios, pró-labore**). Cada grupo tem cabeçalho com pessoas e total a pagar.

| Coluna | Conteúdo |
|---|---|
| Colaborador | Nome (abre a ficha do colaborador) + "função, squad, centro de custo" |
| Contrato | Remuneração vigente |
| Ajustes | Soma com sinal (verde positivo, âmbar negativo) + tipos ("Comissão", "Adiantamento"). **Clicável:** abre o modal de ajustes. Sem ajuste: "—" / "adicionar" |
| Total a pagar | Contrato + todos os ajustes |
| NF da PJ | Recebida (verde) · Pendente (âmbar) · Não se aplica (sócios) |
| Pagamento | Programado dd/mm (azul) · Pago em dd/mm (verde) |
| Ação | **Anexar NF** (se pendente) · **Pagar** · **Comprovante** (se pago) |

**Rodapé:** "Reembolsos não entram no custo da equipe. Adiantamentos já pagos são abatidos do total." + **Total a pagar em dd/mm**.

### 11.6 Solicitar NFs

Envia a cada colaborador com NF pendente o **valor exato a faturar** (contrato + ajustes que compõem a NF; o adiantamento **não** reduz o valor da NF, só o valor a pagar), por e-mail ou WhatsApp assistido. Registra o evento no histórico do colaborador.

### 11.7 Ajustes do mês (modal)

Lista os ajustes existentes (tipo, descrição, valor, remover) + um formulário: **Tipo · Descrição · Valor**. Abaixo, a **regra do tipo** explicada em uma linha.

| Tipo | Categoria / tratamento | Custo de equipe? | Efeito no total |
|---|---|---|---|
| Bônus | Pessoal › Bonificações | Sim | Soma |
| Comissão | Pessoal › Comissões (linha própria em Comercial) | Sim | Soma |
| Job extra | Pessoal › Adicionais, **com cliente/projeto** (vira custo direto do cliente) | Sim | Soma |
| Reembolso | **Categoria real do gasto** (transporte, software) | **Não** | Soma |
| Adiantamento | **Não é item de custo**: é uma baixa parcial antecipada do título do mês | Não | Abate (valor negativo) |
| Desconto | Redução do item de contrato | Sim (reduz) | Abate (valor negativo) |

- Tipos negativos são normalizados: o valor informado positivo vira negativo.
- **Implementação:** cada ajuste é um `document_item` adicional no título do colaborador naquele mês. O adiantamento é uma `settlement` antecipada. **Não é necessária tabela nova para ajustes.**

### 11.8 Pagamento da folha

- **Pagar (linha):** registra a baixa do título do colaborador (PIX da PJ), com comprovante.
- **Pagar quem tem NF:** paga em lote todos com NF recebida (e sócios). Quem não tem NF fica de fora, com aviso nominal.
- **NF exigida:** a categoria de equipe PJ tem `requires_invoice = true`. Pagar individualmente sem NF segue a regra da seção 8 (justificativa).

### 11.9 Ficha do colaborador (drawer 620px)

- **Cabeçalho:** nome · selo ("Colaborador PJ" / "Sócio") · função, squad, centro de custo · ações **Adicionar ajuste** e **Nova remuneração**.
- **Resumo:** remuneração, custo em 12 meses, na Viofilme desde.
- **Alocação e custo por cliente** (só para quem tem capacidade > 0):
  - capacidade (nº de clientes);
  - **custo por vaga** = remuneração ÷ max(capacidade, clientes atendidos);
  - **ociosidade** (vagas livres × custo por vaga; "Acima da capacidade" em vermelho quando clientes > capacidade);
  - **barra de vagas:** uma célula por vaga, preenchida = cliente atendido (tooltip com o nome), tracejada = livre;
  - chips dos clientes atendidos no mês.

  **É a fonte do rateio de equipe** da rentabilidade (documento-mãe, seção 15).
- **Custo nos últimos 12 meses:** barras mensais (contrato + ajustes de custo), mês atual destacado.
- **Contrato:** razão social e CNPJ da PJ, dia de pagamento, data-base de reajuste, centro de custo, PIX.
- **Histórico de remuneração:** versões com data de vigência, motivo e valor.
- **Nova remuneração:** pede valor, **vigência** e motivo, e cria uma nova versão (mesmo mecanismo de `recurrence_versions`).

### 11.10 Relação com o resto do módulo

- Cada colaborador tem uma **recorrência de equipe** (`recurrences.kind = team`) que gera o título do mês. **Essas recorrências não aparecem na aba Recorrências.**
- **DRE:**
  - custo do colaborador em Pessoal › Equipe de entrega (custo direto) ou Equipe de estrutura (despesa), **automaticamente pelo centro de custo**;
  - comissões em linha própria;
  - pró-labore dos sócios conforme o documento-mãe.
- **Contas a pagar:** a folha aparece como linha especial agrupada (5.7).

---

## 12. Aba Recorrências

Custos fixos e assinaturas, **exceto a equipe**.

### 12.1 Faixa de contexto

| Indicador | Cálculo |
|---|---|
| **Custo fixo mensal** | Σ recorrências `out` ativas (estimadas pela estimativa) **+ remuneração-base da equipe e pró-labore**. Sublinha: "Folha R$ X + demais R$ Y" |
| **MRR cobre o custo fixo em** | MRR ÷ custo fixo mensal. Verde ≥ 100%, âmbar 90–100%, vermelho < 90% |
| Ativas · Estimadas · Contratos vencendo em 60 dias | Contagens |

Botão **Reajustar em lote**.

**Por quê a cobertura:** responde, numa linha, se a receita recorrente paga a estrutura. Abaixo de 100%, a empresa depende de trabalhos pontuais para fechar o mês.

### 12.2 Filtros e tabela

- **Chips:** Todas · Estimadas · Softwares e assinaturas · No cartão.
- **Nota fixa:** "A folha é gerida na aba Folha e não aparece aqui."

| Coluna | Conteúdo |
|---|---|
| Fornecedor | |
| Descrição | + vigência ("Contrato até 03/2027", "Assinatura mensal", "Renova em 11/2026") |
| Categoria | |
| Valor mensal | Fixo, ou "~ R$ X" em itálico + "estimado, {método}" |
| Dia | |
| Pagamento | Forma (Boleto, Débito automático, Cartão Inter…) |
| Status | Ativa · Pausada · Encerrada · Rascunho |

### 12.3 Ficha da recorrência

- **Cabeçalho:** fornecedor, descrição, valor + método, ações Editar · Reajustar · Pausar · Encerrar.
- **Valores reais nos últimos 12 meses:** barras. Para estimadas, o mês atual é **tracejado** (estimativa ainda não confirmada). A frase explica a leitura.
- **Dados:** categoria, vencimento, forma, vigência, método de estimativa, centro de custo.
- Itens, histórico de valor (versões) e auditoria, como em Recebimentos.

### 12.4 Regras adicionais

- **Mudar o método de estimativa** atualiza só as parcelas futuras ainda estimadas.
- **Fim de contrato:** aviso 60 dias antes (Dashboard I-informativo + contador da aba), com as ações Renovar · Encerrar · Negociar (nota com lembrete).
- As demais regras (edição com vigência e motivo, pausa, encerramento, reajuste em lote) seguem a spec de Recebimentos, seção 8.5.

---

## 13. Aba Fornecedores

### 13.1 Lista

- **Segmento de tipo:** Todos · Fornecedores · Freelancers · Órgãos públicos. Colaboradores não aparecem aqui.
- Aviso "N fornecedores sem dados de pagamento" (âmbar) · botão **Novo fornecedor**.
- **Ordenação padrão: gasto em 12 meses, decrescente.**

| Coluna | Conteúdo |
|---|---|
| Fornecedor | + ⚠ se faltam dados de pagamento |
| Tipo | |
| Categoria principal | A mais usada em 12 meses |
| Gasto 12 meses | + variação vs. 12 meses anteriores (âmbar se ≥ +20%; "novo este ano") |
| Em aberto | Vermelho se houver vencido |
| Próximo | Data e valor da próxima conta |
| Pagamento padrão | |

### 13.2 Ficha do fornecedor (drawer 620px)

- **Cabeçalho:** tipo, nome, categoria principal, faixa âmbar se faltarem dados de pagamento ("Novas contas vão chegar sem código para copiar", com Completar), ações **Nova despesa deste fornecedor** (abre o cadastro com os padrões) e **Editar cadastro**.
- **Resumo:** gasto em 12 meses, média mensal, em aberto.
- **Gasto mês a mês:** barras de 12 meses.
- **Freelancers:** "Trabalhos por cliente, 12 meses" (cliente, nº de jobs, valor). Liga com a rentabilidade.
- **Dados de pagamento:** forma padrão, chave PIX, favorecido, CNPJ. Texto fixo: "Alterar dados de pagamento pede confirmação e fica registrado na auditoria."
- **Padrões ao lançar:** categoria, centro de custo, conta de saída, exige NF.
- **Contas deste fornecedor** no mês (clicáveis).

### 13.3 Alteração de dados de pagamento

- Exige confirmação explícita ("Você está alterando a conta de destino de {fornecedor}").
- Registra na auditoria os dados antes e depois, usuário e data.
- As **próximas contas** desse fornecedor exibem por 30 dias o aviso: "Dados de pagamento alterados em dd/mm por {usuário}".
- **Por quê:** trocar a conta de destino é um vetor clássico de fraude.

---

## 14. Aprovação

É **desligada por padrão** (documento-mãe, seção 18).

- **Regras combináveis** (Configurações): valor acima de R$ X · criada por quem não é do Financeiro · categorias específicas.
- **Com a regra ligada:**
  - a parcela nasce "Aguardando aprovação" e **não pode ser paga nem programada**;
  - aparece a visão **A aprovar (N)** e a exceção E6 no Dashboard;
  - aprovar individualmente ou em lote;
  - **rejeitar** com motivo obrigatório; volta ao solicitante com notificação;
  - a ficha ganha o bloco **Aprovação** (solicitante, data, justificativa, aprovador ou rejeitante, motivo).
- **Com a regra desligada:** solicitações de outros módulos chegam como **rascunho** e aparecem num banner de revisão, como em Recebimentos. Nada é pago nem programado antes da revisão.

---

## 15. Reembolso a colaborador

Quando alguém da equipe paga uma despesa da empresa com recurso próprio:

- Em Nova despesa › Mais detalhes, **"Pago por colaborador (reembolso)"** + seleção do colaborador.
- A despesa entra com a **categoria real**, a competência da data do gasto e cliente/projeto quando houver.
- O valor vira **ajuste do tipo Reembolso** na folha do colaborador no mês (seção 11.7): é pago junto com a folha e **não conta como custo de equipe**.
- `documents.reimbursement_employee_id` guarda o vínculo.

---

## 16. Impostos e obrigações

Não é aba. São **recorrências com valor estimado** + chip **Impostos e obrigações** + exceção no Dashboard.

| Obrigação | Vencimento | Estimativa padrão |
|---|---|---|
| DAS (Simples Nacional) | Dia 20 | `revenue_pct`: alíquota efetiva × receita bruta do mês anterior |
| INSS sobre pró-labore | Dia 20 | `last` |
| ISS (se aplicável) | Conforme município | `revenue_pct` |
| Outras | Conforme o caso | `last` ou `avg3` |

- A **competência** do DAS é o mês da receita. Ele aparece como **dedução** na DRE do mês certo e na projeção de caixa do mês do pagamento.
- **Nova exceção no Dashboard:** "N contas com valor estimado vencem em até 5 dias" (âmbar), com destino Contas › chip Estimadas.
- **Primeiro uso:** o checklist de implantação oferece criar essas recorrências a partir de um modelo (confirmar datas e alíquota).

---

## 17. Regras de negócio

| Situação | Regra |
|---|---|
| **Pagamento parcial** | Status Parcial; o saldo segue em aberto e na programação |
| **Juros e multa pagos** | Informados manualmente → resultado financeiro. A categoria original fica com o valor da conta |
| **Desconto obtido** | Receita financeira. A categoria original fica com o valor cheio (preserva o orçamento) |
| **Pagamento antecipado** | Permitido; a competência não muda |
| **Programação** | Data opcional, usada na projeção no lugar do vencimento. Se a data passar sem baixa, vale o chip pelo vencimento. A programação fica no histórico |
| **Débito automático** | No vencimento: "Débito previsto hoje". Com extrato, concilia sozinho. Sem extrato: "Confirmar débito" manual |
| **Valor estimado → real** | Seção 9. Diferença > 20% sugere revisar o método |
| **Cancelar** | Motivo obrigatório; em recorrência, cancela só a parcela |
| **Estorno de pagamento** | Motivo obrigatório; a parcela volta a aberta. Devolução do fornecedor é conciliada como entrada vinculada ao estorno |
| **NF exigida** | Pagar sem NF exige justificativa; a pendência fica visível |
| **Favorecido divergente** | Alerta, sem bloqueio; auditoria de quem pagou |
| **Dados bancários alterados** | Confirmação + auditoria + aviso por 30 dias |
| **Duplicidade** | Mesmo fornecedor + valor + mês → aviso. Mesma linha digitável → **bloqueio** |
| **Custo direto sem cliente** | Não salva; oferece "Operação geral" |
| **Equipamento** | Categoria `investment`: fora da DRE; a prévia avisa |
| **Cartão** | Compra = despesa liquidada na conta do cartão, com competência na data da compra. Fatura = transferência |
| **Reembolso** | Categoria real + ajuste de reembolso na folha |
| **Adiantamento à equipe** | Baixa antecipada do título do mês; não é custo novo |
| **Pagamento em lote** | Fornecedores diferentes permitidos; estimadas e NF exigida ausente ficam de fora |

---

## 18. Automações

| Automação | Controle humano |
|---|---|
| Gerar parcelas das recorrências (janela de 3 meses), incluindo a folha | Visível na ficha da recorrência / aba Folha |
| Calcular valores estimados | Selo "~ Estimada"; confirmação manual |
| Ler documento (boleto, NF, guia, fatura) via Edge Function + Claude | Campos marcados "lido do documento" até revisão |
| Detectar favorecido divergente | Alerta na ficha e na lista |
| Herdar padrões e dados de pagamento do fornecedor | Editável |
| Gerar compras de assinaturas no cartão a cada ciclo | Confirmadas pela importação da fatura |
| Sugerir categoria na importação da fatura e aprender com a confirmação | Botão Confirmar; regras editáveis em Configurações |
| Montar a fatura a partir das compras | Linha especial; conferência pela importação |
| Calcular a cobertura dos próximos 7 dias por conta | Indicador; nunca bloqueia |
| Avisar fim de contrato (60 dias) e reajuste (30 dias) | Ações explícitas |
| Conciliar débitos automáticos com o extrato | Automática quando valor e fornecedor batem |
| Calcular custo por vaga e ociosidade | Derivado da remuneração e da alocação |

---

## 19. Integrações e funcionamento independente

| Módulo | Integração | Sem o módulo |
|---|---|---|
| **Operação** | `freelancer.requested`, locação para job, compra para projeto → **rascunho** (ou "Aguardando aprovação") com cliente/projeto preenchidos | Cadastro manual |
| **RH** | Mudança de remuneração (`employee.cost_changed`) → proposta de nova versão da recorrência de equipe, com vigência. Alocação e capacidade pré-preenchidas | Folha, remuneração e alocação mantidas no Financeiro |
| **Comercial** | Negócios ganhos alimentam a sugestão de comissão (futuro) | Comissão como ajuste manual |
| **Planejamento** | Orçamento usado na prévia e na leitura do custo | Sem orçamento: as linhas de orçamento somem |
| **Caixa** | Conciliação, cartão (importação da fatura), transferências | — |
| **Resultados** | Rateio por cliente/projeto e custo por vaga | — |

---

## 20. Ajustes no modelo de dados (incluir no documento-mãe)

### 20.1 Valor estimado
- `installments.amount_status` (`estimated`, `confirmed`) e `installments.estimated_amount` (o valor estimado original, preservado ao confirmar).
- `recurrences.estimation_method` (`fixed`, `last`, `avg3`, `revenue_pct`) + `estimation_params` (alíquota, mês de referência).

### 20.2 Dados de pagamento
- `installments.payment_details` (jsonb): `method`, `barcode`, `pix_key_type`, `pix_key`, `bank`, `branch`, `account`, `payee_name`, `payee_document`.
- `parties`: `pix_key_type`, `pix_key`, `bank_account` (jsonb), `payee_name`. Alterações auditadas, com `payment_data_changed_at` para o aviso de 30 dias.

### 20.3 Documentos
- `attachments.kind` (`boleto`, `invoice_nf`, `receipt`, `contract`, `other`).
- `categories.requires_invoice`, `categories.requires_receipt`.
- `settlements.missing_invoice_justification`.

### 20.4 Cartão
- `financial_accounts` (tipo `credit_card`): `closing_day`, `due_day`, `last_digits`, `limit`, `payment_account_id`.
- Compra: título `out` com `payment_method = credit_card`, liquidado na conta do cartão; `card_installments` quando parcelada (nº, total, parcela atual).
- Fatura: **derivada** (view por cartão + ciclo). Pagamento: `transfers`.

### 20.5 Equipe
- `parties` papel `team_member`: `contract_type` (`pj`, `clt`, `intern`, `partner`), `legal_entity_name`, `legal_entity_document`, `role_title`, `squad_id`, `cost_center_id`, `payment_day`.
- `recurrences.kind` (`standard`, `team`).
- `team_allocations`: capacidade + clientes atendidos por mês (já previsto no documento-mãe; editável na ficha do colaborador).
- Ajustes: `document_items` com categorias de pessoal (Bonificações, Comissões, Adicionais) ou categoria real (reembolso); adiantamento como `settlement` antecipada.
- Permissão `view_compensation`.

### 20.6 Aprovação
- `approval_rules` (condições combináveis) e `approvals` (`installment_id`, `requested_by`, `requested_at`, `reason`, `status`, `decided_by`, `decided_at`, `decision_reason`).

### 20.7 Leitura de documento e reembolso
- `documents.extracted_from_attachment_id` + `documents.extracted_fields` (lista dos campos preenchidos pela leitura).
- `documents.reimbursement_employee_id`.

---

## 21. Parâmetros configuráveis

| Parâmetro | Padrão |
|---|---|
| Categorias que exigem NF | Freelancers, Serviços de terceiros, Equipe PJ |
| Categorias que exigem comprovante | Nenhuma |
| Diferença estimado × real para sugerir revisão | 20% |
| Antecedência do alerta de estimadas | 5 dias |
| Aviso de fim de contrato | 60 dias |
| Aviso após alteração de dados de pagamento | 30 dias |
| Referência de mão de obra sobre receita | 40% |
| Dia de pagamento da equipe | 5 |
| Alíquota efetiva do Simples | Informada (ex.: 6%) |
| Regras de aprovação | Desligadas |
| Cartões | Cadastro (fechamento, vencimento, limite, conta de pagamento) |

---

## 22. Permissões e auditoria

- A página é acessível a diretoria e perfis do Financeiro.
- **`view_compensation`** controla:
  - a aba Folha;
  - a ficha do colaborador;
  - os valores individuais de pessoal em qualquer lista (sem a permissão: "valor restrito").
- **Auditoria obrigatória em:**
  - criação e edição;
  - confirmação de valor estimado;
  - pagamento sem NF (com justificativa);
  - pagamento com favorecido divergente;
  - alteração de dados de pagamento;
  - aprovação e rejeição;
  - ajustes de folha;
  - nova remuneração;
  - estorno e cancelamento;
  - pagamento de fatura.

---

## 23. Casos de borda

- **Estimada vencida sem valor informado:** continua "~ Estimada" e também vencida (chip vermelho), com a ação "Informar valor". Não pode ser paga sem confirmar o valor.
- **Débito automático não aparece no extrato:** após 3 dias do vencimento, vira exceção "Débito não confirmado".
- **Boleto lido com vencimento já passado:** aceita, mas avisa "vencido na leitura" e abre os campos de encargos no pagamento.
- **Compra no cartão após o fechamento:** entra na próxima fatura; a prévia mostra isso.
- **Fatura importada com compra não lançada:** aparece em "sem classificação" e vira despesa ao confirmar.
- **Assinatura cancelada no fornecedor mas ativa no sistema:** a importação da fatura aponta "assinatura esperada não encontrada neste ciclo".
- **Colaborador com mais clientes que a capacidade:** custo por vaga usa o nº real de clientes; a ficha mostra "Acima da capacidade" em vermelho.
- **Colaborador sem capacidade** (administrativo, comercial): a seção de alocação não aparece; o custo vai inteiro para estrutura.
- **Adiantamento maior que o valor do mês:** o saldo negativo passa para o mês seguinte como abatimento, com aviso.
- **NF da PJ com valor diferente do esperado:** ao anexar, se o valor lido divergir do "valor a faturar", aparece um aviso antes de aceitar.
- **Pagamento em lote com saldo insuficiente em alguma data:** a tela de confirmação sinaliza as linhas afetadas, sem bloquear.
- **Mesmo boleto enviado duas vezes pelo fornecedor:** bloqueado pela linha digitável.

---

## 24. Fora do escopo desta versão

- Pagamento integrado ao banco (API do Inter) e remessa CNAB.
- Caixa de entrada de boletos por e-mail.
- Retenções de impostos na NF do fornecedor (IRRF, CSRF, ISS retido).
- Alíquota do Simples calculada automaticamente pela tabela e RBT12.
- Detecção de assinaturas sem uso ou duplicadas.
- Comissão calculada automaticamente a partir do CRM.
- Folha CLT com cálculo de encargos (o modelo já suporta `contract_type = clt`, mas sem cálculo).
