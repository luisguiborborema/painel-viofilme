# Viofilme ERP — Financeiro
## Página 1: Dashboard Financeiro · Parte 2 de 2 — Blocos 4 e 5, overlays e estados

**Versão:** 1.0 · setembro/2026
**Público:** desenvolvimento (Gui)
**Documento-mãe:** `viofilme_financeiro_regras_gerais.md`. Todas as entidades, status, métricas e regras citadas aqui estão definidas lá. Em caso de conflito, o documento-mãe prevalece.
**Mockup de referência:** `mockup_parte2.html`, fonte legível do mockup só com os blocos desta parte (layout, cores, textos, dados de exemplo e lógica). Leia esse arquivo, não o `Design___Dashboard_Financeiro.html`: o original é um bundle de ~260 KB com fontes e bibliotecas embutidas, que estoura o contexto. O original serve apenas para abrir no navegador e ver o visual. Os dados do mockup são fictícios, mas coerentes entre si. Use-os como exemplo de cálculo.

---

## Como usar este arquivo

Esta é a continuação de `viofilme_dashboard_parte1.md`. **Parta do princípio de que a Parte 1 já está implementada:** cabeçalho, faixa "Desde ontem", Blocos 1 a 3, a camada de métricas da seção 12, os parâmetros da seção 13, as permissões da seção 14 e a atualização de dados da seção 15. Consulte a Parte 1 só quando precisar de um detalhe dela; não reimplemente o que já existe.

**Nesta parte:** Bloco 4 (Esta semana), Bloco 5 (Panorama), ficha universal, baixa rápida e toast, estados especiais da página (incluindo "Primeiro uso"), persistência de preferências, casos de borda restantes, o que fica fora do Dashboard e evoluções futuras.

A numeração das seções é a do documento original, para que as referências cruzadas continuem valendo.

### Lembretes da Parte 1 que afetam esta parte

- **Princípios:** nenhum cálculo no front-end; todo número navega para a página correspondente com o filtro já aplicado; cada bloco tem título + frase; espaçamento de 48px entre blocos; a página está sempre no presente, sem filtro de período nem de conta.
- **Métricas (seção 12)** já existem na camada de métricas e são usadas aqui: Saldo projetado, Menor saldo projetado (30d), Saídas de resultado (mês).
- **Parâmetros (seção 13)** usados aqui: reserva mínima de caixa (Slide 1) e tolerância de orçamento (Slide 4).
- **Cores do card MRR e pontual (6.2):** recorrente = cor de destaque do sistema; pontual = azul-claro. O Slide 2 precisa usar as mesmas cores.
- **Permissões (seção 14):** baixa, envio de cobrança e aprovação feitos no Dashboard respeitam as permissões das páginas de origem e geram a mesma auditoria. Não existe atalho sem registro.
- **Atualização (seção 15):** a página é revalidada após qualquer ação; o realtime dos webhooks do Asaas também atualiza o Bloco 4.
- **Overlays da página:** ficha universal (drawer lateral), baixa rápida (modal) e toast de confirmação.

### Estrutura geral (referência)

```
Cabeçalho  (título, data, [Importar extrato], [+ Novo ▾])
Faixa "Desde ontem"

1. Precisa da sua atenção        → exceções, por gravidade
2. Pulso                          → 4 cards: Saldo · Caixa 30d · Resultado · MRR e pontual
3. Entradas e saídas              → painel Recebimentos | painel Pagamentos (composição expansível)
4. Esta semana                    → lista de lançamentos, hoje até +7 dias, rolagem interna
5. Panorama                       → carrossel com 4 visões gráficas
```

---

## 8. Bloco 4 — Esta semana

**Frase do bloco:** "Cada entrada e saída de hoje até dd/mm, com a ação ao lado."

### 8.1 Dados

- Parcelas **abertas** (`open`/`partial`) com vencimento **de hoje até hoje+7**, nas duas direções.
- **Vencidas não entram**, porque já estão no Bloco 1.
- Parcelas com `scheduled_payment_date` usam essa data.
- Ordenação: data asc → saídas antes de entradas no mesmo dia → valor desc.

### 8.2 Layout

- **O quadro tem altura fixa**: 7 linhas visíveis (56px cada, lista com 392px). **A lista rola por dentro**, e o quadro nunca muda de tamanho.
- Cabeçalho de colunas fixo; rodapé fixo.
- Controle segmentado **Todas / Entradas / Saídas**, ao lado do título. É o único filtro da página.

| Coluna | Conteúdo |
|---|---|
| Data | "Hoje" e "Amanhã" em destaque; demais como "Seg 21" |
| Direção | Ícone ↑ entrada (verde) / ↓ saída (neutro) |
| Pessoa e descrição | Nome em destaque + descrição. **Clicável: abre a ficha universal** |
| Situação | Selo: Programado · Sem programação · Cobrança enviada · Sem cobrança · Aguardando aprovação |
| Conta | Conta prevista ou "Não definida" |
| Valor | Saldo em aberto, com sinal + / − |
| Ação | Botão contextual (8.3) |

**Rodapé:** "N lançamentos · Entra R$ X · Sai R$ Y" (respeitando o filtro) + link "Abrir no fluxo de caixa" (Caixa › Fluxo, mesmo intervalo).

### 8.3 Ação contextual por linha

| Situação | Botão | Efeito |
|---|---|---|
| Entrada sem cobrança (forma de cobrança via sistema) | **Enviar cobrança** | Emite a cobrança no Asaas (Edge Function). O selo muda para "Cobrança enviada" e a E5 é recalculada |
| Entrada com cobrança | **Registrar recebimento** | Abre a baixa rápida |
| Saída | **Registrar pagamento** | Abre a baixa rápida |
| Saída aguardando aprovação | **Aprovar** | Aprova (só com a regra ligada) |

**Estado vazio do filtro:** "Nada previsto para esta semana neste filtro."

---

## 9. Bloco 5 — Panorama (carrossel)

**Frase do bloco:** "Caixa, receita, resultado e custos em leitura rápida. Passe para o lado para ver cada visão."

### 9.1 Mecânica do carrossel

- **Um quadro só**, com uma visão por vez ocupando a largura inteira.
- **Navegação:**
  - setas ‹ › no canto do título, com navegação circular (da última volta para a primeira);
  - **abas nomeadas** acima do quadro, que levam direto à visão;
  - contador "N de 4".
- Transição horizontal (slide) de ~450ms.
- **Cada slide tem duas colunas:**
  - **Esquerda (340px) — leitura:** título, **frase com a conclusão** (gerada por regra, 9.3), 4 a 5 números-chave em linhas e o link para a página de análise.
  - **Direita — gráfico.**
- **Extensível:** adicionar uma visão = criar um slide + uma aba. Implementar os slides como **array de configuração** (id, título, componente de gráfico, função de resumo), não como markup fixo.

### 9.2 As 4 visões

**Slide 1 · Caixa em 30 dias**
- **Gráfico:** linha do saldo projetado dia a dia (hoje a hoje+30), área suave abaixo, linha tracejada da reserva mínima e **ponto do menor saldo marcado com rótulo**.
- **Hover** em qualquer dia: tooltip com data, saldo e resumo do que acontece no dia (ex.: "Folha, pró-labore e encargos − R$ 63.400").
- **Números:** saldo hoje, saldo em 30 dias, menor saldo (data), entradas previstas, saídas previstas.
- **Nota fixa:** "Recebimentos vencidos ficam fora da projeção. Se forem pagos, somam mais R$ X."
- **Regra de projeção:** seção 12, "Menor saldo projetado". É a mesma regra do Caixa › Fluxo.
- **Link:** Abrir fluxo de caixa.

**Slide 2 · Composição da receita do mês**
- **Gráfico:**
  1. barra empilhada recorrente × pontual do total do mês;
  2. **por serviço**: barra horizontal empilhada recorrente/pontual + total, ordenada por total desc;
  3. **pontuais do mês**: top 3 títulos pontuais (pessoa, descrição, valor).
- **Números:** receita do mês, recorrente (MRR) com %, pontual com %, variação do MRR em 30 dias.
- **Link:** Abrir receita.

**Slide 3 · Resultado nos últimos 6 meses**
- **Gráfico:** colunas agrupadas por mês, **receita** × **tudo que reduz o resultado** (deduções + custos diretos + despesas operacionais + resultado financeiro líquido). Abaixo de cada mês: resultado em R$ e % da receita. O mês corrente vem **hachurado** e rotulado "em curso".
- **Números:** resultado do mês, média dos 6 meses, receita no período, resultado no período.
- **Link:** Abrir DRE.

**Slide 4 · Para onde vai o dinheiro no mês**
- **Gráfico:** barras horizontais por **grupo de categoria** (primeiro nível do plano de contas) das saídas que afetam o resultado, ordenadas desc, com valor e % do total. Grupos com realizado + previsto acima do orçamento ganham barra âmbar e selo com o %.
- **Números:** total do mês, % em relação à receita, maior grupo com %, grupo mais acima do orçado.
- **Link:** Abrir DRE.

### 9.3 Frases de conclusão (geradas por regra)

As frases são **templates com condições**, calculadas no back-end. **Não usam IA nesta versão.** Uma frase por slide; se nenhuma regra se aplicar, usa a frase padrão.

| Slide | Regras (em ordem de prioridade) | Exemplo |
|---|---|---|
| Caixa | (a) menor saldo < reserva → "O caixa fica abaixo da reserva em dd/mm, por causa de {maior saída do dia}." · (b) menor saldo < 50% do saldo atual → "O caixa aperta no dia dd, com {maior saída}, mas continua acima da reserva mínima." · (c) padrão → "O caixa se mantém estável nos próximos 30 dias." | "O caixa aperta no dia 5, com a folha, mas continua acima da reserva mínima." |
| Receita | "X% da receita é recorrente." + serviço com maior participação de pontual (se > 30% do serviço): "{Serviço} é o serviço que mais depende de trabalhos pontuais." | "81% da receita é recorrente. Audiovisual é o serviço que mais depende de trabalhos pontuais." |
| Resultado | Sequência de alta/queda ≥ 2 meses → "N° mês seguido de alta/queda no resultado." · senão, comparação com a média. + "Mês ainda em curso." quando aplicável | "Terceiro mês seguido de alta no resultado." |
| Gastos | Maior grupo com % ("{Grupo} é quase metade / X% de tudo que sai.") + grupos acima do orçado | "Equipe de entrega é quase metade de tudo que sai. Softwares estão acima do orçado." |

---

## 10. Ficha universal e baixa rápida

### 10.1 Ficha universal (drawer lateral, 480px)

É aberta pelo nome da pessoa em "Esta semana" e, no futuro, por qualquer lista do módulo. **É o mesmo componente em todo o Financeiro**, invocado por `installment_id` (documento-mãe, seção 22).

- **Cabeçalho:**
  - tipo (Conta a receber / Conta a pagar);
  - pessoa e descrição;
  - valor;
  - selos de status (armazenado + derivado);
  - **origem** (ex.: "Gerado pela recorrência 'Clínica Vitta — Mensalidade'", "Veio da Operação, solicitação de freelancer nº 214").
- **Corpo:**
  - vencimento, competência, parcela (n de N) e conta prevista;
  - **itens** (categoria + dimensões + valor);
  - **cobrança** (só entradas: método, status no provedor, "Copiar link");
  - **histórico**.
- **Rodapé:**
  - ação principal: Registrar recebimento / Registrar pagamento;
  - ação secundária: Enviar/Reenviar cobrança (entrada) ou Programar/Reprogramar pagamento (saída);
  - "Cancelar parcela" (pede o motivo, conforme o documento-mãe, seção 17).

### 10.2 Baixa rápida (modal)

**Campos pré-preenchidos:**
- **Data:** hoje.
- **Valor:** saldo da parcela.
- **Conta:** a conta da cobrança; senão, a última conta usada com essa pessoa; senão, a conta padrão.
- **"Adicionar juros, multa ou desconto":** recolhido; ao expandir, mostra 3 campos.
- **Anexar comprovante:** opcional.

**Confirmar cria a baixa conforme o documento-mãe (seção 13.3):**
- em conta com `requires_statement_confirmation = true`, a movimentação nasce `pending_confirmation`;
- o toast informa: "Pagamento registrado: {pessoa}, R$ X. Aguardando confirmação no extrato {conta}."

A linha sai de "Esta semana" e os agregados da página são revalidados.

**Validação:**
- valor > 0;
- valor ≤ saldo + encargos, ou então pede confirmação de "valor acima do saldo";
- data não futura;
- data em período fechado exige justificativa (documento-mãe, seção 17.2).

---

## 11. Estados especiais da página

| Estado | Quando | Comportamento |
|---|---|---|
| **Operação normal** | Padrão | Tudo como descrito |
| **Tudo em dia** | Nenhuma exceção 🔴/🟠 | O Bloco 1 mostra o estado positivo (5.3, regra 7). Os demais blocos, normais |
| **Primeiro uso** | Passos 1 **ou** 4 do checklist incompletos | Os Blocos 1 a 5 e a faixa "Desde ontem" são substituídos pelo **checklist de implantação** (abaixo) |

**Checklist de implantação:**
1. Cadastrar contas financeiras e saldo inicial.
2. Revisar o plano de categorias (vem pré-carregado com o padrão de agência).
3. Cadastrar clientes e fornecedores (manual ou importação CSV).
4. Criar as recorrências de receita.
5. Criar as recorrências de despesa.

Mostra a barra de progresso e o botão "Começar" em cada passo pendente. A conclusão de cada passo é **derivada dos dados**, sem flag manual. Exemplos: passo 1 = existe conta ativa com saldo inicial; passo 4 = existe ao menos uma recorrência `in` ativa.

---

## 16. Persistência de preferências

Por usuário, em localStorage (preferência de UI):

- filtro de "Esta semana" (Todas / Entradas / Saídas);
- estado aberto/fechado das composições de Recebimentos e Pagamentos;
- último slide visto no Panorama.

Avisos ⚪ silenciados: **no banco** (5.3, regra 4), porque precisam valer em qualquer dispositivo.

---

## 17. Casos de borda (desta parte)

- **Conta sem saldo inicial:** a página fica em "Primeiro uso" até o passo 1 ser concluído.
- **Slide sem dados** (ex.: menos de 6 meses de histórico no Slide 3): mostra os meses que existem, e a frase informa "Histórico a partir de mm/aaaa".
- **Fuso:** "hoje" e "vencido" usam sempre `America/Sao_Paulo`.

---

## 18. Fora do Dashboard, de propósito

- Filtros de período, conta, cliente ou categoria.
- Régua de cobrança e configurações.
- Rentabilidade por cliente e serviço (fica em Resultados).
- Edição completa de lançamentos (a ficha tem ações rápidas; a edição completa fica na página de origem).

---

## 19. Evoluções futuras

- **Resumo diário** por notificação ou e-mail, apenas quando houver exceção 🔴.
- Frases de conclusão do Panorama geradas por IA (Edge Function), com fallback para as regras da seção 9.3.
- Novos slides no Panorama, por exemplo evolução do MRR mês a mês e aging completo.
- Pipeline comercial ponderado na projeção de caixa.
