# Viofilme ERP — Financeiro
## Página 2: Recebimentos

**Versão:** 1.0 · setembro/2026
**Público:** desenvolvimento (Gui)
**Documento-mãe:** `viofilme_financeiro_regras_gerais.md`. Entidades, status, métricas e regras citadas aqui estão definidas lá. Em caso de conflito, o documento-mãe prevalece.
**Spec relacionada:** `viofilme_financeiro_dashboard_spec.md`, que define exceções que apontam para esta página.
**Mockup de referência:** https://claude.ai/artifact/R7Qo6LQKks94jSw15gBTtr. Os dados são fictícios; os cálculos do mockup seguem as regras deste documento.

---

## Sumário

1. Objetivo
2. Estrutura da página
3. Faixa de indicadores
4. Aba Contas a receber
5. Ficha da conta a receber
6. Registrar recebimento
7. Nova receita (cadastro)
8. Aba Recorrências
9. Aba Inadimplência
10. Aba Clientes e ficha do cliente
11. Regras de negócio
12. Automações
13. Integrações internas e funcionamento independente
14. Ajustes no modelo de dados (incluir no documento-mãe)
15. Parâmetros configuráveis
16. Permissões e auditoria
17. Persistência de preferências
18. Casos de borda
19. Fora do escopo desta versão

---

## 1. Objetivo

Recebimentos é **o lugar de todo dinheiro que precisa entrar**. A página responde a quatro perguntas, e cada uma é uma atividade diferente, com sua própria aba:

| Aba | Pergunta | Objeto principal |
|---|---|---|
| **Contas a receber** | O que tenho para receber e o que preciso fazer? | Parcela (`installments`, direção `in`) |
| **Recorrências** | Quais contratos geram receita todo mês? | Recorrência (`recurrences`) |
| **Inadimplência** | Quem está devendo e o que estou fazendo a respeito? | Cliente com parcelas vencidas |
| **Clientes** | Como cada cliente se comporta financeiramente? | Pessoa com papel `client` (`parties`) |

**Princípios desta página:**
- **Robusta por baixo, simples na frente.** Formulários completos, mas com padrões inteligentes e prévia do resultado.
- **Tudo que é automático mostra o que fez e o que vai fazer** (origem, etapa da régua, próximo passo).
- **Nada bloqueia a operação sem motivo.** O sistema só impede o que realmente depende do dado faltante.

---

## 2. Estrutura da página

```
Cabeçalho: "Recebimentos" + subtítulo            [Importar CSV] [+ Nova receita]
Faixa de indicadores (4 cards, igual em todas as abas)
Abas: Contas a receber · Recorrências · Inadimplência (badge) · Clientes
Conteúdo da aba
```

**Overlays da página:**
- ficha da conta a receber (drawer 580px, expansível para tela cheia);
- ficha do cliente (drawer 620px);
- ficha da recorrência (drawer 600px);
- nova receita (drawer 900px);
- registrar recebimento (modal);
- barra de ações em lote (flutuante);
- toast.

**Badge da aba Inadimplência:** nº de clientes com parcela vencida, em vermelho. Some quando é zero.

**Botões do cabeçalho:**
- **Importar CSV:** importação de receitas com mapeamento de colunas. É essencial para a implantação.
- **+ Nova receita:** abre o drawer de cadastro (seção 7).

---

## 3. Faixa de indicadores

É igual em todas as abas e fica fixa acima delas. Todos os cards são clicáveis.

| Card | Número | Contexto | Clique |
|---|---|---|---|
| **A vencer no mês** | Σ `open_balance` de parcelas `in` não vencidas com vencimento no mês selecionado | "N parcelas, M sem cobrança" | Contas › Em aberto |
| **Recebido no mês** | Σ principal baixado de parcelas do mês + barra de progresso | "X% de R$ Y previstos" | Contas › Recebidas |
| **Vencido** | Σ `open_balance` de todas as parcelas `in` vencidas (qualquer mês) | "N clientes, mais antigo há X dias" | Aba Inadimplência |
| **Inadimplência 90 dias** | Métrica do dicionário | "Atraso médio de X dias" | Aba Inadimplência |

"Mês selecionado" é o período escolhido na aba Contas a receber. O padrão é o mês corrente.

---

## 4. Aba Contas a receber

É a aba padrão. Cada linha é uma **parcela** de direção `in`.

### 4.1 Visões

Segmento com contador em cada opção:

| Visão | Conteúdo | Ordenação |
|---|---|---|
| **Em aberto** (padrão) | Parcelas `open` e `partial` | Vencidas primeiro (mais antiga no topo), depois por vencimento asc |
| **Vencidas** | Parcelas com saldo e vencimento < hoje | Mais antiga primeiro |
| **Recebidas** | Parcelas `settled` e parciais com baixa | Data da baixa desc |
| **Todas** | Inclui canceladas e renegociadas | Vencimento asc |

O contador de "Vencidas" fica em vermelho quando a visão não está selecionada.

**Não existe tab "Histórico".** O histórico é a visão Recebidas.

### 4.2 Barra de controle

- **Período:** `‹ Setembro 2026 ›`. Pelo menu, atalhos: Este mês, Próximo mês, Últimos 3 meses, Personalizado.
- **Base do período:** segmento **Vencimento | Competência**. O padrão é Vencimento. Com Competência, o filtro de mês passa a usar `competence_month`.
- **Busca:** cliente, descrição, número da NF e valor. "4500" encontra R$ 4.500,00.
- **Filtros visíveis:** Cliente, Serviço, Origem (recorrência, projeto, avulsa).
- **Mais filtros:** categoria, forma de cobrança, situação da cobrança, conta prevista, NF pendente, centro de custo.
- **Chip "Sem cobrança (N)":** alterna o filtro de parcelas abertas sem `charge` ativa. Ao ligar, muda a visão para Em aberto. **É o destino da exceção E5 do Dashboard.**
- **Colunas:** seletor de colunas opcionais, salvo por usuário.

### 4.3 Tabela

| Coluna | Padrão | Conteúdo |
|---|---|---|
| ☐ | ✅ | Seleção. O cabeçalho seleciona tudo no filtro |
| Vencimento | ✅ | `dd/mm` + linha derivada colorida: "hoje" (âmbar), "em N dias" (azul até 7 dias), "há N dias" (vermelho), "Paga em dd/mm" |
| Cliente | ✅ | Nome. **Clique abre a ficha do cliente** |
| Descrição | ✅ | Texto + ícone ↻ se veio de recorrência + selo "2/3" se parcelada. **Clique abre a ficha da conta** |
| Situação | ✅ | Chip de situação (4.4) + linha da cobrança (4.5) |
| Valor | ✅ | Saldo em aberto. Linha auxiliar: parcial → "de R$ X"; vencida → "R$ X atualizado" (âmbar, com juros e multa); recebida → "recebido em dd/mm" |
| Ação | ✅ | Botão contextual + menu ⋯ |
| Competência | opcional | |
| Serviço(s) | opcional | |
| Forma de cobrança | opcional | |
| Conta prevista | opcional | |
| NF | opcional | Número ou "Pendente" |
| Origem | opcional | Recorrência / Projeto / Avulsa / Conciliação / Comercial |

**Linha selecionada:** fundo levemente destacado com a cor de destaque.

**Rodapé da tabela:** "N parcelas neste filtro" + totais do filtro: **Total**, **Em aberto** (não vencido), **Recebido**, **Vencido**.

### 4.4 Chip de situação

Combina o status armazenado com o derivado num único texto. É calculado, nunca gravado.

| Chip | Cor | Condição |
|---|---|---|
| A vencer | Cinza | Aberta, vencimento > hoje + 7 |
| Vence em N dias | Azul | Aberta, vencimento entre amanhã e hoje + 7 |
| Vence hoje | Âmbar | Vencimento = hoje |
| Vencida há N dias | Vermelho | Saldo > 0 e vencimento < hoje |
| Parcial | Âmbar | `partial`, não vencida |
| Parcial, vencida há N dias | Vermelho | `partial` e vencida |
| Recebida | Verde | `settled` |
| Renegociada / Cancelada | Cinza | Só na visão Todas |

### 4.5 Linha da cobrança

A situação da cobrança é um eixo separado da situação financeira: uma parcela pode "vencer em 3 dias" com a cobrança "não visualizada".

| Texto | Cor | Condição |
|---|---|---|
| Sem cobrança | Âmbar | Nenhuma `charge` ativa e forma de cobrança via sistema |
| Envio automático em dd/mm | Cinza | Envio programado (D−N) |
| Cobrança enviada em dd/mm | Azul | `charge` enviada |
| Visualizada pelo cliente | Verde | Evento de visualização do provedor |
| Falha no envio | Vermelho | E-mail inválido, dados incompletos, erro do provedor |
| Confirmada no extrato / Aguardando extrato | Verde / Cinza | Parcela recebida: status de conciliação da baixa |

### 4.6 Ação contextual por linha

| Situação | Botão | Efeito |
|---|---|---|
| Aberta sem cobrança | **Enviar cobrança** | Emite no Asaas (Edge Function). A linha muda para "Cobrança enviada" |
| Aberta com cobrança | **Registrar** | Abre o modal de recebimento (seção 6) |
| Recebida | **Comprovante** | Abre o anexo/comprovante da baixa |

**Menu ⋯:** Alterar vencimento · Reemitir cobrança · Copiar link de pagamento · Enviar lembrete agora · Duplicar · Renegociar · Cancelar.

### 4.7 Ações em lote

A seleção faz aparecer uma **barra flutuante** na parte inferior, com o texto "N selecionadas, R$ X" (soma dos saldos).

| Ação | Regra |
|---|---|
| **Emitir cobranças** | Emite só para as selecionadas sem cobrança ativa. As demais são ignoradas, e o toast informa quantas foram emitidas |
| **Enviar lembrete** | Um lembrete por cliente (agrupado), não um por parcela |
| **Alterar vencimento** | Nova data para todas + reemissão das cobranças ativas |
| **Registrar recebimento** | **Só para parcelas do mesmo cliente.** Com clientes diferentes, o sistema bloqueia e explica: "Recebimento em lote só para parcelas do mesmo cliente" |
| **Exportar** | CSV com as colunas visíveis |
| ✕ | Limpa a seleção |

Trocar de visão, de mês ou de aba limpa a seleção.

### 4.8 Atalhos de teclado

`N` nova receita · `/` foco na busca · `↑` `↓` navegar linhas · `Enter` abrir ficha · `R` registrar recebimento (com ficha aberta) · `Esc` fechar drawer/modal.

Só funcionam com o foco na página, **nunca como listener global que intercepte campos de texto**.

---

## 5. Ficha da conta a receber

É o componente de ficha universal do módulo (documento-mãe, seção 22), invocado por `installment_id`. Abre como **drawer de 580px** com botão **expandir para tela cheia**.

### 5.1 Cabeçalho (fixo no topo)

1. Tipo: "Conta a receber" · botões Expandir e Fechar.
2. **Cliente** (link para a ficha do cliente) + descrição.
3. **Saldo** em destaque + linha auxiliar:
   - vencida: "R$ X atualizado hoje, com multa e juros" (âmbar);
   - parcial: "Saldo de R$ X, já recebido R$ Y";
   - recebida: "Recebido em dd/mm".
4. Chips: situação (4.4) e cobrança (4.5).
5. **Linha de origem clicável:**
   - "Gerada pela recorrência “APTO — Mensalidade”" → abre a ficha da recorrência;
   - "Parte do projeto “X”, criado por {usuário} em dd/mm" → abre o projeto (Operação) ou o título pai;
   - "Veio do Comercial, negócio ganho em dd/mm";
   - "Criada na conciliação em dd/mm".
6. **Ações:**
   - aberta: **Registrar recebimento** (principal) + **Enviar cobrança** / **Reenviar cobrança**;
   - recebida: **Ver comprovante**;
   - sempre: **Editar** e menu ⋯ (Alterar vencimento, Renegociar, Duplicar, Cancelar, Estornar recebimento).

### 5.2 Corpo (rolável)

| Seção | Conteúdo |
|---|---|
| **Resumo** (grid 3 colunas) | Vencimento · Competência · Conta prevista · Forma de cobrança · NF (número ou "Pendente" em âmbar) · Parcela com **mini linha do tempo**: uma bolinha por parcela do título (paga = preenchida verde; atual = contorno na cor de destaque; futura = contorno cinza), cada uma clicável, + "2 de 3" |
| **Itens** | Uma linha por `document_item`: serviço, categoria + centro de custo + projeto, valor |
| **Cobrança** | Etapas **Criada → Enviada → Visualizada → Paga**, com data em cada uma (barra verde nas concluídas) · link de pagamento com "Copiar link" (se houver `charge`) · **frase da régua** com a etapa atual e o próximo passo (5.3) · destinatários ("Enviada para …") |
| **Recebimentos** | Uma linha por baixa: data, descrição (forma, conta, encargos, dispensa, desconto), valor e status de conciliação ("Confirmado no extrato" verde / "Aguardando confirmação no extrato" cinza). Sem baixa: "Nenhum recebimento registrado" |
| **Anexos** | Área de arrastar e soltar (NF, comprovante, contrato) |
| **Observações** | Texto livre, nota interna, salva ao sair do campo |
| **Histórico** | Auditoria completa em linha do tempo, incluindo ações automáticas da régua e contatos registrados |

### 5.3 Frase da régua (por situação)

| Situação | Frase |
|---|---|
| Recebida | "Régua encerrada: parcela recebida." |
| Aberta com envio programado | "Envio automático programado para dd/mm (D−5)." |
| Aberta sem cobrança | "Sem cobrança emitida. O envio automático não está programado para esta parcela." |
| Aberta, cobrança enviada | "Próximo passo: lembrete por e-mail no dia do vencimento (D+0)." |
| Vencida, etapa D+3 | "Etapa atual: D+3, aviso de atraso enviado. Próximo: WhatsApp no D+10." |
| Vencida, etapa D+10 pendente | "Etapa atual: D+10, WhatsApp pendente de envio. Próximo: acionar CS no D+20." |
| Com promessa ativa | "Régua pausada: promessa de pagamento para dd/mm." |
| Régua pausada manualmente | "Régua pausada até dd/mm: {motivo}." |

### 5.4 Modo edição

"Editar" transforma Resumo e Itens em formulário dentro da própria ficha. Antes de salvar, o sistema mostra o **impacto**:

| Situação | Comportamento |
|---|---|
| Parcela veio de recorrência | Pergunta: **"Aplicar só a esta parcela"** / **"A esta e às próximas (altera a recorrência a partir de dd/mm)"** |
| Tem cobrança ativa e o valor ou vencimento mudou | Aviso: "A cobrança atual será cancelada e reemitida" + checkbox "Avisar o cliente por e-mail" (marcado) |
| Competência em período fechado | Campo de justificativa obrigatório |
| Parcela com baixa | Valor e itens bloqueados, com a explicação: "Estorne o recebimento para alterar o valor" |

---

## 6. Registrar recebimento

É um modal (500px), aberto pela linha, pela ficha, pelo Dashboard ou pela Inadimplência.

### 6.1 Campos

| Campo | Padrão |
|---|---|
| Data | Hoje |
| Valor recebido | Saldo + encargos sugeridos (se vencida) |
| Conta | Conta da cobrança; senão, a última usada com o cliente; senão, a conta padrão |
| Anexar comprovante | Opcional |

### 6.2 Parcela vencida: encargos

Aparece o bloco "Encargos por atraso (N dias)", com o valor total dos encargos.

- **Cálculo:** multa = saldo × % multa; juros = saldo × % juros ao mês × dias / 30 (pro rata). O detalhamento é exibido, junto com o valor atualizado.
- Os percentuais vêm do **cliente** (se personalizados) ou do **padrão** (Configurações; padrão 2% + 1% ao mês).
- Chave **"Dispensar encargos"**. Ao ligar:
  - o valor recebido é recalculado sem os encargos;
  - aparecem os motivos (seleção obrigatória): **Acordo com cliente · Atraso nosso · Cortesia**.
- **Na baixa, principal e encargos são gravados separadamente** (documento-mãe, seção 5.2). Os encargos vão para resultado financeiro.

### 6.3 Valor diferente do saldo

- **Menor que saldo (+ encargos, se não dispensados):** aparece a escolha obrigatória:
  - "Manter R$ X em aberto (pagamento parcial)": a parcela fica `partial`;
  - "Dar desconto de R$ X e quitar": a parcela fica `settled`, e a diferença é registrada como desconto.
- **Maior:** a diferença é classificada como juros/multa, se a parcela estiver vencida; senão, o sistema pergunta: "Registrar a diferença como outra receita?"

### 6.4 Cobrança ativa

Se houver `charge` enviada ou visualizada, aparece o checkbox (marcado por padrão): **"Cancelar a cobrança no Asaas, para o cliente não pagar duas vezes"**.

- Em pagamento parcial, o texto muda para **"Reemitir a cobrança pelo saldo de R$ X"**.

### 6.5 Ao confirmar

1. Cria a baixa (`settlements`) com principal, encargos, desconto e conta.
2. Cria a movimentação conforme o documento-mãe (seção 13.3): em conta com confirmação por extrato, nasce `pending_confirmation`.
3. Atualiza o saldo e o status da parcela.
4. Cancela ou reemite a cobrança, conforme o checkbox.
5. Encerra a régua da parcela, se quitada.
6. Grava a auditoria.
7. Toast: "Recebimento registrado: {cliente}, R$ X. [Saldo de R$ Y segue em aberto.] Aguardando confirmação no extrato {conta}."

**Validações:**
- valor > 0;
- data não futura;
- data em período fechado exige justificativa;
- dispensa de encargos exige motivo.

---

## 7. Nova receita (cadastro)

É um drawer de **900px**, em duas colunas: **formulário à esquerda** e **prévia viva à direita (330px)**.

A prévia é obrigatória e mostra exatamente o que será criado antes de salvar. É o que torna seguro um formulário completo.

### 7.1 Tipo

Três cartões selecionáveis no topo:
- **Única** ("Um vencimento");
- **Parcelada** ("Projeto em parcelas");
- **Recorrente** ("Mensalidade, contrato").

O formulário é o mesmo para os três; só a seção Condições muda.

### 7.2 Cliente

- Select com busca. Ao escolher, **aplica os padrões do cliente**: forma de cobrança, dia de vencimento, conta, e-mails, régua, juros e multa. Um texto informa: "Padrões do cliente aplicados: …".
- Se o cadastro do cliente estiver incompleto para a forma escolhida (ex.: boleto sem endereço ou sem CNPJ), aparece o aviso inline e o erro na prévia (7.8).
- Última opção do select: **"+ Cadastrar novo cliente"**, que abre o **cadastro rápido embutido**:
  - **CPF/CNPJ + botão "Buscar dados":** consulta pública de CNPJ via Edge Function, que preenche razão social, nome fantasia e endereço. Se falhar, preenchimento manual;
  - **e-mail de cobrança;**
  - **"Usar este cliente":** cria a pessoa com papel `client` e a seleciona.
  - Campos que faltarem deixam o cliente marcado como "cadastro incompleto".

### 7.3 Descrição

Sugerida automaticamente pelo tipo ("Mensalidade", "Projeto", "Serviço avulso"). Deixa de ser automática assim que o usuário edita o campo. Para recorrência, a descrição de cada parcela gerada recebe o mês: "Mensalidade Out/26".

### 7.4 Itens

Uma linha por item: **Serviço** (select) · **Categoria** (sugerida, com o selo "sugerida") · **Valor** · remover.

- "+ Adicionar item" e **Total** somado em tempo real.
- **Regra de sugestão de categoria:**
  - recorrente → "Receita › Mensalidades";
  - Audiovisual ou Projetos e consultoria (não recorrente) → "Receita › Projetos";
  - demais → "Receita › Serviços avulsos".

  A categoria pode ser trocada por um select de categorias de `operating_revenue`.
- Centro de custo: padrão "Entrega", editável em "Mais detalhes".

### 7.5 Condições

**Única:**
- Vencimento.
- Competência: preenchida com o mês do vencimento, exibida como texto com o link "alterar".

**Parcelada:**
- Número de parcelas, 1º vencimento, intervalo (mensal ou quinzenal).
- **Competência** (escolha):
  - "Uma por parcela, no mês de cada vencimento" (padrão);
  - "Toda no mês da primeira parcela (entrega única)".
- Divisão: valores iguais; a última parcela absorve o arredondamento.
- Futuro próximo: tabela de parcelas editável para valores diferentes.

**Recorrente:**
- Início, dia de vencimento, periodicidade (mensal, trimestral, anual).
- **Competência de referência:** "Mês do vencimento" ou "Mês anterior ao vencimento".
- **Término:** sem término / em data / após N cobranças.
- **Reajuste:** nenhum / índice informado (anual) / % fixo ao ano, com data-base.
- **Vínculo com contrato:** opcional; aparece só se o módulo Comercial existir.
- **Início no passado** (implantação): ao salvar, o sistema pergunta se as parcelas passadas devem ser geradas como **já recebidas**, como **em aberto**, ou **não geradas**.

### 7.6 Cobrança

- **Forma:** Asaas, PIX e boleto · Asaas, só PIX · Manual, transferência · Sem cobrança.
- **Régua:** Padrão · personalizadas (Configurações) · Nenhuma.
- **Chave "Enviar a cobrança automaticamente N dias antes do vencimento"** (padrão ligada, N do cliente ou 5). Mostra os destinatários e os juros e multa aplicados.

### 7.7 Mais detalhes (recolhido)

Centro de custo · Projeto · Número da NF · Conta de recebimento · Observação interna.

### 7.8 Prévia viva

- **Título e subtítulo:** "Uma conta a receber" / "3 parcelas de R$ 2.000,00" / "Recorrência de R$ 4.500,00 por mês", com total, cliente e, para recorrência, "MRR sobe R$ X".
- **Lista de parcelas** com número, vencimento, competência e valor:
  - parcelada: até 4 + a última, e "N parcelas intermediárias ocultas";
  - recorrente: as 3 primeiras (a 1ª com borda sólida, as demais tracejadas) + "E segue todo mês…" conforme o término.
- **Linhas de resumo:** como será cobrado, qual régua, separação da receita por serviço, reajuste.
- **Bloco "Para salvar, falta:"** com cada pendência em texto.

### 7.9 Rodapé e salvamento

**Botões:** Salvar e criar outra · Salvar · **Salvar e enviar cobrança** (principal; fica esmaecido enquanto houver pendências).

| Botão | Efeito |
|---|---|
| Salvar | Cria título, itens e parcelas (ou a recorrência + primeiras parcelas). Cobrança: `scheduled` se envio automático, senão sem cobrança |
| Salvar e enviar cobrança | Idem + emite e envia a cobrança da primeira parcela imediatamente |
| Salvar e criar outra | Salva e reabre o formulário mantendo o cliente |

**Após salvar:** a aba Contas a receber vai para o mês da primeira parcela, na visão Em aberto, e o toast confirma o que foi criado.

**Validações:**
- cliente;
- ao menos 1 item com valor > 0;
- vencimento;
- cadastro compatível com a forma de cobrança (boleto exige CPF/CNPJ + endereço).

O botão salvar, clicado com pendências, lista o que falta no toast; ele não fica simplesmente desabilitado.

**Proteção contra duplicidade:** mesmo cliente + mesmo valor total + vencimento no mesmo mês gera o aviso "Já existe '{descrição}' de {cliente} com esse valor. Criar mesmo assim?".

---

## 8. Aba Recorrências

O objeto é a **regra**, não a parcela.

### 8.1 Faixa de contexto

MRR · Ativas · Pausadas · Reajustes em 30 dias (âmbar) · Encerrando em 60 dias · botão **Reajustar em lote**.

### 8.2 Banner de rascunhos

Aparece só quando existem recorrências com status `draft` vindas de outro módulo. Mostra quantas são, a origem, os clientes e o aviso "Nada é cobrado antes da sua revisão", com o botão **Revisar**. Some quando não há rascunhos.

### 8.3 Tabela

| Coluna | Conteúdo |
|---|---|
| Cliente | Nome + vigência ("Desde mar/2025", "Até dez/2026", "Pausada até 01/11") |
| Serviços | Chips dos serviços dos itens |
| Valor mensal | Valor + variação recente em verde/vermelho ("+ R$ 500 em ago"), quando houve mudança nos últimos 90 dias |
| Vencimento | "Todo dia N" |
| Próxima cobrança | Data + situação (gerada, sem cobrança, envio dd/mm, enviada, vencida) |
| Reajuste | Mês ou "IPCA em dd/mm" (âmbar se em até 30 dias) |
| Status | Ativa (verde) · Pausada (âmbar) · Encerrada (cinza) · Rascunho (roxo) |

Filtros: status, serviço, cliente. A linha inteira abre a ficha da recorrência.

### 8.4 Ficha da recorrência

- **Cabeçalho:**
  - cliente;
  - valor mensal e dia;
  - status;
  - ações: **Editar · Reajustar · Pausar · Encerrar**.
- **Linha do tempo (8 meses):** 3 meses anteriores + mês atual + 4 à frente. Cada bloco mostra o mês e o estado:
  - paga (verde sólido);
  - em aberto / vencida (contorno azul / vermelho);
  - gerada (contorno azul);
  - projetada (tracejado cinza, ainda não existe como parcela);
  - pausada (tracejado).
- **Itens da regra.**
- **Histórico de valor:** cada versão com data de vigência, motivo e valor (lido de `recurrence_versions`).
- **Configuração:** vigência, reajuste, competência, cobrança.
- **Histórico** (auditoria).

### 8.5 Regras

| Ação | Regra |
|---|---|
| **Editar valor ou itens** | **Sempre pede a data de vigência e o motivo** (upsell, downsell, correção, reajuste). Cria uma nova versão. Parcelas a partir da vigência **sem baixa** são atualizadas (e as cobranças reemitidas); parcelas com baixa nunca mudam |
| **Reajustar** | % ou índice informado + data. Mesma mecânica da edição, com motivo "reajuste" |
| **Reajuste em lote** | Seleciona recorrências, informa % e data de vigência, e confirma numa tela de revisão com o valor antes e depois de cada uma |
| **Pausar** | Motivo obrigatório + data de retomada (opcional). Para de gerar parcelas. As parcelas já geradas do período de pausa aparecem para o usuário decidir entre **manter** e **cancelar**. Sai do MRR imediatamente |
| **Retomar** | Volta a gerar a partir da data escolhida |
| **Encerrar** | Data de término + **motivo obrigatório** (churn, fim de contrato, troca de contrato, outro). Parcelas após o término e sem baixa são canceladas com motivo "Recorrência encerrada". Parcelas em aberto até o término continuam e seguem na régua |
| **Rascunho → Ativa** | Revisar e ativar gera as parcelas da janela de materialização |

---

## 9. Aba Inadimplência

A unidade é o **cliente** com saldo vencido, não a parcela.

### 9.1 Topo

**Card "Vencidos por tempo de atraso"** (aging):
- 5 faixas: **1–7 · 8–15 · 16–30 · 31–60 · 60+ dias**. Cada faixa mostra valor, barra proporcional e nº de clientes.
- **Clicar numa faixa filtra a lista.** A faixa ativa fica destacada, e aparece "Limpar filtro".

**Card de indicadores:**
- **Total vencido** + contexto;
- **Inadimplência 90 dias** + meta (configurável);
- **Atraso médio**;
- **Promessas ativas.**

### 9.2 Régua de cobrança

Uma faixa com as etapas configuradas. Cada etapa mostra o dia, a ação, o modo (automático, manual, tarefa) e **quantos clientes estão nela hoje**. As etapas com clientes ficam em âmbar. O link "Configurar régua" leva a Configurações.

**Régua padrão:**

| Etapa | Ação | Modo |
|---|---|---|
| D−5 | Envio da cobrança | Automático, e-mail |
| D+0 | Lembrete no vencimento | Automático, e-mail |
| D+3 | Aviso de atraso | Automático, e-mail |
| D+10 | WhatsApp | **Manual até existir template aprovado** |
| D+20 | CS acionado | Automático, notificação |
| D+30 | Diretoria | Tarefa para o responsável definido |

Clientes com promessa ativa ou régua pausada não entram na contagem das etapas.

### 9.3 Lista de clientes

| Coluna | Conteúdo |
|---|---|
| Cliente | Nome + "CS: {responsável}" |
| Vencido | Soma do saldo vencido + nº de parcelas |
| Atraso | Dias da parcela mais antiga |
| Etapa e próximo passo | Etapa atual (âmbar se houver pendência manual; azul se pausada) + próximo passo com data |
| Último contato | Último evento de cobrança relevante |
| Perfil | Perfil pagador (seção 10.3) |

Ordenação: atraso desc. A linha inteira expande/recolhe, com uma linha aberta por vez.

### 9.4 Linha expandida

**Coluna esquerda:**
1. **Parcelas vencidas:** descrição (abre a ficha), data de vencimento, saldo e valor atualizado (âmbar).
2. **Pendência manual da régua**, quando houver (ex.: D+10 WhatsApp):
   - bloco âmbar com a **mensagem pronta** (cliente, valor, vencimento, link de pagamento);
   - **"Abrir no WhatsApp"**: link `wa.me` com o número de cobrança e o texto;
   - **"Marcar como enviado"**: registra o contato e a etapa como concluída.
3. **Linha do tempo da cobrança:** todos os `collection_events` (automáticos, manuais, promessas), com ponto de cor por tipo.

**Coluna direita — ações:**

| Ação | Comportamento |
|---|---|
| **Enviar lembrete agora** | Escolha do canal (e-mail/WhatsApp) + mensagem pronta e editável. Registra o evento |
| **Registrar contato** | Nota + resultado: não atendeu / vai pagar / pediu prazo / contestou |
| **Registrar promessa de pagamento** | Formulário inline: **data prometida** + valor (atualizado, somente leitura). Pausa a régua até a data |
| **Renegociar** | Abre o acordo (9.5) |
| **Pausar régua** | Motivo + prazo obrigatórios |
| **Acionar CS** | Envia o sinal ao módulo de CS com o resumo. Sem o módulo, notifica o responsável definido em Configurações |
| **Registrar como perda** | Motivo obrigatório. Gera o lançamento em "Perdas com recebíveis". Nada é apagado |

### 9.5 Renegociação (acordo)

1. Seleciona as parcelas vencidas do cliente.
2. Mostra o total original + encargos, com opção de dispensar encargos (com motivo).
3. Define as novas condições (única ou parcelada, vencimentos, forma de cobrança).
4. Ao confirmar:
   - as parcelas originais ficam **Renegociada**, com `renegotiated_to` apontando para o novo título;
   - o novo título nasce com origem "Renegociação de {parcelas}";
   - a régua recomeça nas novas parcelas.

### 9.6 Promessa de pagamento

- **Estados:** `active` → `fulfilled` (houve baixa até a data) / `broken` (data passou sem baixa) / `cancelled`.
- **Efeito na interface:** com a promessa ativa, a etapa mostra "Régua pausada", o próximo passo mostra "Promessa de pagamento para dd/mm" e o último contato mostra "Promessa registrada {data}".
- **Promessa quebrada:** gera evento na linha do tempo, retoma a régua na etapa correspondente aos dias de atraso e sobe o cliente na lista (a quebra conta como sinal de risco no perfil).

---

## 10. Aba Clientes e ficha do cliente

É o lugar do **cadastro financeiro** do cliente. É isso que garante que o Financeiro funcione sem o CRM.

### 10.1 Lista

- **Controles:** busca (nome ou CNPJ) · filtros Perfil pagador e Status · aviso "N com cadastro incompleto para cobrança" (âmbar, clicável para filtrar) · botão **Novo cliente**.

| Coluna | Conteúdo |
|---|---|
| Cliente | Nome + ⚠ se incompleto; linha auxiliar "Desde mm/aaaa" ou "Falta X para boleto" |
| MRR | Soma das recorrências ativas |
| Serviços | Chips |
| Em aberto | Saldo não vencido |
| Vencido | Saldo vencido (vermelho) |
| Recebido 12m | Soma das baixas nos últimos 12 meses |
| Atraso médio | Últimos 12 meses |
| Perfil pagador | Chip (10.3) |

### 10.2 Ficha do cliente (drawer)

- **Cabeçalho:**
  - nome;
  - chip de perfil;
  - "Cliente desde";
  - se incompleto: faixa âmbar "Falta X. Boleto bloqueado até completar." + botão **Completar**;
  - ações: **Nova receita para este cliente** (abre o cadastro com o cliente preenchido) · **Editar cadastro**.
- **Resumo:** 6 números — MRR, Em aberto, Vencido, Recebido 12 meses, Atraso médio, Pagas em dia.
- **Dados cadastrais:** razão social, CPF/CNPJ, endereço, inscrição municipal. Campos faltantes em âmbar, com "Não informado".
- **Contatos de cobrança:** responsável financeiro, WhatsApp de cobrança, e-mails de cobrança (vários). **São separados dos contatos comerciais.**
- **Preferências de cobrança:** forma padrão, dia de vencimento, envio automático (N dias), régua, juros e multa (padrão ou personalizados), conta de recebimento.
- **Recorrências** do cliente (lista compacta, clicável).
- **Parcelas** do mês (clicáveis, abrem a ficha da conta).
- **Cobrança:** linha do tempo de contatos, promessas e renegociações.
- **Anexos:** contratos, aditivos.
- **Histórico.**

### 10.3 Perfil pagador (derivado)

Calculado sobre as parcelas liquidadas nos últimos 12 meses:

| Perfil | Regra padrão |
|---|---|
| **Pontual** (verde) | ≥ 90% do valor pago até o vencimento |
| **Atrasa às vezes** (âmbar) | 70% a 90% |
| **Atrasa com frequência** (vermelho) | < 70%, **ou** 2+ promessas quebradas no período |

- Cliente com menos de 3 parcelas liquidadas: "Sem histórico" (cinza).
- É recalculado após cada baixa. Os limites ficam em Configurações.

### 10.4 Cadastro mínimo vs. completo

- O cliente pode existir só com nome + e-mail (cadastro rápido).
- **Só é bloqueado o que depende do dado faltante:**
  - boleto exige CPF/CNPJ + endereço;
  - PIX via Asaas exige CPF/CNPJ;
  - envio automático exige e-mail de cobrança.
- O cliente fica marcado com ⚠ e aparece no aviso da aba até ser completado.

---

## 11. Regras de negócio

| Situação | Regra |
|---|---|
| **Pagamento parcial** | Status `partial`; o saldo segue cobrado; a régua segue sobre o saldo; a cobrança é reemitida pelo saldo (checkbox marcado por padrão) |
| **Pagamento a maior** | A diferença vira juros/multa (se vencida) ou outra receita (com confirmação). Nunca fica sem classificação |
| **Um PIX pagando várias parcelas** | Resolvido na conciliação (Caixa), vínculo N:N. Cada parcela mostra sua parte nos Recebimentos |
| **Recebimento em lote** | Só parcelas do mesmo cliente |
| **Alterar vencimento** | Só com saldo > 0. Reemite a cobrança. O vencimento original fica no histórico. O sistema pergunta se os encargos passam a contar do novo vencimento (acordo) ou do original |
| **Cancelar parcela** | Motivo obrigatório (lista padrão + texto). Cancela a cobrança no provedor. Em recorrência, cancela só a parcela, nunca a regra |
| **Cancelar receita de mês fechado** | Não reescreve: gera o lançamento de perda/estorno (documento-mãe, seção 17) |
| **Estorno de recebimento** | Motivo obrigatório. A parcela volta a `open`/`partial`. **A régua não reinicia sozinha**: a parcela aparece para revisão com o aviso "Régua pausada após estorno" |
| **Juros e multa** | Exibidos como "valor atualizado" (cálculo diário, só exibição). O Asaas aplica no boleto. Na baixa manual, são sugeridos e podem ser dispensados com motivo |
| **Competência ≠ vencimento** | Sempre visível na ficha e disponível como base do filtro |
| **Cliente encerra contrato** | Encerrar as recorrências com motivo. Parcelas em aberto continuam e seguem na régua |
| **Recebimento sem título** | Criado na conciliação; aparece como Recebida com origem "Criada na conciliação" |
| **Duplicidade** | Aviso ao salvar (mesmo cliente + valor + mês) |
| **NF** | Número, data e anexo por título. "NF pendente" é filtro e coluna opcional. Não gera exceção por padrão (configurável) |
| **Cadastro incompleto** | Bloqueia apenas a forma de cobrança dependente (10.4); o resto funciona |

---

## 12. Automações

| Automação | Gatilho | Controle humano / visibilidade |
|---|---|---|
| Gerar parcelas das recorrências | Job diário, janela de 3 meses | Linha do tempo da recorrência; parcelas com ícone ↻ |
| Emitir e enviar cobrança | D−N (padrão 5) | Liga/desliga por cliente e por título; exibido como "Envio automático em dd/mm" |
| Baixa automática | Webhook de pagamento do Asaas (Edge Function) | Baixa com origem "Asaas" e conciliação automática (nível 1) |
| Visualização da cobrança | Webhook do Asaas | Etapa "Visualizada" na ficha e linha da cobrança |
| Régua de cobrança | Dias de atraso (job diário) | Pausa por promessa ou manualmente; etapas manuais viram pendência na Inadimplência |
| Promessa quebrada | Data prometida sem baixa (job diário) | Evento na linha do tempo; régua retoma |
| Aviso de reajuste | 30 dias antes da data-base | Aviso na aba Recorrências e no Dashboard (I4); a aplicação exige confirmação quando o índice é informado |
| Valor atualizado | Diário | Só exibição |
| Perfil pagador | Após cada baixa | Derivado |
| Sugestões no cadastro | Cliente → padrões; serviço → categoria; CNPJ → dados | Tudo editável |

---

## 13. Integrações internas e funcionamento independente

| Módulo | Integração | Sem o módulo |
|---|---|---|
| **Comercial** | `deal.won` → **recorrência ou título em rascunho** (banner na aba Recorrências) | Cadastro manual em Nova receita |
| **Operação** | Projeto com valor → **título parcelado em rascunho** vinculado ao projeto | Parcelada manual, com projeto opcional |
| **CS** | Recebe `receivable.overdue`, `receivable.settled`, `promise.created` e `promise.broken` (com valor, conforme a regra de visibilidade do documento-mãe, seção 21). "Acionar CS" gera ação no módulo. Coluna "CS" na Inadimplência | "Acionar CS" notifica o responsável definido em Configurações; a coluna CS mostra esse responsável |
| **Portal do cliente** | Faturas leem `installments` + `charges`; a visualização pelo portal entra na linha do tempo da cobrança | — |
| **Asaas** | Emissão, cancelamento, reemissão, webhooks de pagamento e visualização — sempre via Edge Function | Forma "Manual, transferência": sem link, baixa manual |

---

## 14. Ajustes no modelo de dados (incluir no documento-mãe)

### 14.1 `recurrence_versions`

Histórico de valor da recorrência com vigência. **É a base da evolução do MRR** (expansão, contração, churn).
- Campos: `recurrence_id`, `effective_from`, `items` (snapshot), `monthly_amount`, `reason` (`created`, `upsell`, `downsell`, `adjustment`, `correction`), `created_by`.
- O valor atual da recorrência = a versão vigente na data.

### 14.2 Campos novos em `recurrences`

- `status`: `draft` · `active` · `paused` · `ended`.
- `paused_until`, `pause_reason`.
- `end_reason`: `churn`, `contract_end`, `contract_change`, `other`.
- `competence_ref`: `same_month` / `previous_month`.
- `adjustment_rule` + `adjustment_base_date`.

### 14.3 `payment_promises`

- Campos: `party_id`, `installment_ids[]`, `promised_date`, `amount`, `status` (`active`, `fulfilled`, `broken`, `cancelled`), `created_by`, `created_at`, `resolved_at`.

### 14.4 `collection_events`

Linha do tempo de cobrança.
- Campos: `party_id`, `installment_id` (opcional), `type` (`charge_sent`, `reminder`, `overdue_notice`, `whatsapp`, `cs_triggered`, `escalation`, `contact`, `promise`, `promise_broken`, `renegotiation`, `pause`, `resume`, `write_off`), `channel`, `automatic` (bool), `result` (para contatos), `note`, `created_by`, `created_at`.

### 14.5 `dunning_profiles` e `dunning_steps`

Réguas configuráveis.
- `dunning_steps`: `profile_id`, `offset_days` (negativo = antes do vencimento), `action`, `mode` (`automatic`, `manual`, `task`), `channel`, `template_id`.
- Uma régua `default = true`.

**Estado da régua por parcela/cliente:** derivado dos `collection_events` + dias de atraso + promessas/pausas ativas. **Não é gravado.**

### 14.6 Campos financeiros em `parties` (papel cliente)

- `billing_emails[]`, `billing_whatsapp`, `billing_contact_name`;
- `default_billing_method`, `default_due_day`, `default_account_id`, `default_send_days_before`;
- `dunning_profile_id`;
- `custom_fine_pct`, `custom_interest_pct` (nulos = padrão);
- `municipal_registration`;
- endereço estruturado (logradouro, número, complemento, bairro, cidade, UF, CEP).

### 14.7 Campos novos em `documents` e `installments`

- `documents`: `nf_number`, `nf_date`, `nf_attachment_id`.
- `installments`: `renegotiated_to`, `original_due_date` (preenchido na primeira alteração de vencimento).

### 14.8 Campos novos em `settlements`

- `fee_waived` (bool), `fee_waiver_reason`, `waived_amount`.

---

## 15. Parâmetros configuráveis

Todos ficam em **Configurações Financeiras**.

| Parâmetro | Padrão |
|---|---|
| Multa por atraso | 2% |
| Juros por atraso | 1% ao mês, pro rata |
| Dias de antecedência do envio automático | 5 |
| Janela de materialização de recorrências | 3 meses |
| Régua padrão | Tabela da seção 9.2 |
| Responsável por "Acionar CS" sem módulo de CS | Definir |
| Responsável pela etapa D+30 | Diretoria (Iago) |
| Limites do perfil pagador | 90% / 70% |
| Meta de inadimplência 90d | 3% |
| NF pendente gera exceção | Não |
| Motivos de dispensa de encargos | Acordo com cliente · Atraso nosso · Cortesia |

---

## 16. Permissões e auditoria

- A página é acessível a **diretoria e perfis do Financeiro**. O CS vê os dados da carteira na área "Sua carteira" (módulo de CS), sem operar cobrança.
- **Auditoria obrigatória** (documento-mãe, seção 19) em:
  - criação e edição (com antes/depois);
  - alteração de vencimento;
  - cancelamento, estorno e renegociação;
  - registro de perda;
  - dispensa de encargos;
  - promessa;
  - pausa e retomada de régua;
  - mudança de versão de recorrência.
- Ações automáticas são registradas com usuário "sistema" + o nome da automação.

---

## 17. Persistência de preferências

Por usuário, em localStorage:
- visão da aba Contas a receber;
- base do período (vencimento/competência);
- colunas visíveis;
- última aba aberta.

O mês selecionado **não** é persistido: a página sempre abre no mês corrente.

---

## 18. Casos de borda

- **Parcela de mês anterior ainda vencida:** aparece em Vencidas e no card Vencido, independentemente do mês selecionado na navegação. Na visão Em aberto de um mês, aparece apenas se o vencimento for daquele mês.
- **Recorrência criada no meio do mês com dia de vencimento já passado:** a primeira parcela vai para o mês seguinte. A prévia mostra isso.
- **Dia de vencimento 29, 30 ou 31:** em meses mais curtos, a parcela usa o último dia do mês.
- **Parcelado com valor que não divide exato:** a última parcela absorve a diferença de centavos.
- **Cliente sem e-mail de cobrança com envio automático ligado:** a cobrança não é enviada; a linha mostra "Falha no envio: cliente sem e-mail" e o cliente fica marcado como incompleto.
- **Webhook de pagamento para parcela já baixada manualmente:** não cria segunda baixa. Vincula a movimentação à baixa existente (confirmação) e alerta se o valor divergir.
- **Pagamento recebido após cancelamento da parcela:** a movimentação fica não conciliada no Caixa, com a sugestão de reabrir a parcela ou registrar como outra receita.
- **Promessa para data anterior a hoje:** não é permitida.
- **Cliente com vencidos em várias faixas de aging:** aparece no filtro de qualquer faixa em que tenha parcela.
- **Estorno em parcela de mês fechado:** exige justificativa (período fechado).
- **Edição de recorrência com vigência retroativa:** só afeta parcelas sem baixa; as com baixa ficam como estão, e o sistema lista as que não foram alteradas.

---

## 19. Fora do escopo desta versão

- Desconto por pagamento antecipado.
- Cartão de crédito via Asaas.
- Reajuste com índice buscado automaticamente (a v1 usa índice informado).
- Emissão de NF integrada.
- Envio automático por WhatsApp (a v1 tem a etapa pronta, com envio manual assistido).
- Visões salvas personalizadas.
- Crédito do cliente (sobra de pagamento abatida na parcela seguinte).
- Tabela editável de parcelas com valores diferentes no cadastro parcelado.
