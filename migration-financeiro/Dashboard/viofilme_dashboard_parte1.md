# Viofilme ERP — Financeiro
## Página 1: Dashboard Financeiro · Parte 1 de 2 — Fundação e Blocos 1 a 3

**Versão:** 1.0 · setembro/2026
**Público:** desenvolvimento (Gui)
**Documento-mãe:** `viofilme_financeiro_regras_gerais.md`. Todas as entidades, status, métricas e regras citadas aqui estão definidas lá. Em caso de conflito, o documento-mãe prevalece.
**Mockup de referência:** `mockup_parte1.html`, fonte legível do mockup só com os blocos desta parte (layout, cores, textos, dados de exemplo e lógica). Leia esse arquivo, não o `Design___Dashboard_Financeiro.html`: o original é um bundle de ~260 KB com fontes e bibliotecas embutidas, que estoura o contexto. O original serve apenas para abrir no navegador e ver o visual. Os dados do mockup são fictícios, mas coerentes entre si. Use-os como exemplo de cálculo.

---

## Como usar este arquivo

A spec do Dashboard foi dividida em duas partes para caber numa sessão de trabalho. **Implemente esta Parte 1 por completo antes de abrir a Parte 2** (`viofilme_dashboard_parte2.md`).

**Nesta parte:** objetivo e princípios, estrutura geral, cabeçalho e faixa "Desde ontem", Bloco 1 (Precisa da sua atenção), Bloco 2 (Pulso), Bloco 3 (Entradas e saídas), camada de métricas novas, parâmetros configuráveis, permissões, atualização de dados e os casos de borda desses blocos.

**Fica para a Parte 2:** Bloco 4 (Esta semana), Bloco 5 (Panorama), ficha universal, baixa rápida, toast, estado "Primeiro uso" com checklist de implantação e persistência de preferências. Deixe os espaços dos Blocos 4 e 5 reservados no layout, mas não os implemente agora.

A numeração das seções é a do documento original, para que as referências cruzadas (ex.: "5.3, regra 7", "seção 12") continuem valendo nas duas partes.

---

## 1. Objetivo

O Dashboard responde, nesta ordem:

1. **"Tem algum problema financeiro que eu preciso resolver hoje?"**
2. **"A empresa está saudável neste momento?"**

É a **janela para o macro do Financeiro**. É uma página única, igual para todos os níveis de acesso ao módulo, do operador ao sócio. A ordem dos blocos vai do operacional (topo) ao gerencial (fim). Quem opera resolve o dia nos primeiros blocos; quem só quer saber como está desce até o Panorama.

---

## 2. Princípios da página

- **Sem filtro de período nem de conta.** A página está sempre no presente: hoje, mês corrente, últimos e próximos 7 dias, próximos 30 dias. Outros recortes ficam nas páginas de análise.
- **Nenhum cálculo no front-end.** Todo número vem da camada de métricas (documento-mãe, seção 16) ou das consultas de exceção desta spec.
- **Todo número leva a algum lugar.** Cards, exceções e gráficos navegam para a página correspondente, **com o filtro já aplicado**.
- **Cada bloco tem título e uma frase que explica do que ele trata.** No Panorama, cada visão traz a conclusão escrita, e não só o gráfico.
- **Progressive disclosure.** Detalhes secundários ficam atrás de expansão ("Ver composição", "N avisos", popover de saldo).
- **Espaçamento generoso entre blocos** (48px no mockup). A página deve respirar.

---

## 3. Estrutura geral

```
Cabeçalho  (título, data, [Importar extrato], [+ Novo ▾])
Faixa "Desde ontem"

1. Precisa da sua atenção        → exceções, por gravidade
2. Pulso                          → 4 cards: Saldo · Caixa 30d · Resultado · MRR e pontual
3. Entradas e saídas              → painel Recebimentos | painel Pagamentos (composição expansível)
4. Esta semana                    → lista de lançamentos, hoje até +7 dias, rolagem interna
5. Panorama                       → carrossel com 4 visões gráficas
```

Overlays da página: **ficha universal** (drawer lateral), **baixa rápida** (modal), **toast** de confirmação.

---

## 4. Cabeçalho

| Elemento | Comportamento |
|---|---|
| Título + data | "Dashboard" + data por extenso (fuso `America/Sao_Paulo`) |
| **Importar extrato** | Abre a importação OFX/CSV. Visível enquanto existir conta com `requires_statement_confirmation = true` sem integração ativa |
| **+ Novo ▾** | Menu: **Receita** (conta a receber/cobrança), **Despesa** (conta a pagar única ou parcelada), **Transferência** (entre contas próprias). Abre os formulários padrão do módulo |

### Faixa "Desde ontem"

- **Janela:** desde as 00:00 do dia anterior. Se a última visita do usuário foi há mais de 1 dia, a janela passa a ser "desde a sua última visita".
- **Conteúdo:**
  - nº e soma das baixas de entrada no intervalo;
  - nº e soma das baixas de saída no intervalo;
  - até 1 evento de destaque, por prioridade: parcela vencida quitada, cobrança visualizada de valor alto, pagamento de cliente em atraso.
- **Clique:** abre o Extrato (Caixa) filtrado no intervalo.
- **Oculta quando:** não houve nenhum movimento no intervalo, ou no estado "Primeiro uso".

---

## 5. Bloco 1 — Precisa da sua atenção

Lista de **exceções derivadas**. **Não existe tabela de alertas.** Cada exceção é uma consulta sobre o estado atual e desaparece sozinha quando o problema é resolvido.

### 5.1 Catálogo de exceções

| # | Exceção | Condição | Gravidade | Destino (com filtro) |
|---|---|---|---|---|
| E1 | Pagamento vencido | Parcela `out`, `due_date < hoje`, `open_balance > 0` | 🔴 Crítico | Pagamentos › vencidos |
| E2 | Caixa abaixo do mínimo | Menor saldo projetado em 30 dias < reserva mínima | 🔴 se ocorrer em ≤ 7 dias · 🟠 se em 8–30 | Caixa › Fluxo, no dia do menor saldo |
| E3 | Recebimentos vencidos | Parcelas `in` vencidas com saldo | 🟠 · 🔴 se alguma tiver > 30 dias | Recebimentos › vencidos |
| E4 | Pagamentos de hoje e amanhã | Parcelas `out` abertas com vencimento hoje ou amanhã | 🟠 | Pagamentos › filtro de data |
| E5 | Cobrança não enviada | Parcela `in` vence em ≤ N dias e não tem `charge` ativa (só para formas de cobrança via sistema) | 🟠 | Recebimentos › seleção pronta para emissão em lote |
| E6 | Aprovações pendentes | Só se a regra de aprovação estiver ligada | 🟠 | Pagamentos › a aprovar |
| E7 | Conciliação pendente | Movimentações `unreconciled` | 🟠 se a mais antiga > 7 dias ou qtd > 20 · ⚪ caso contrário | Caixa › Conciliação |
| E8 | Baixa sem confirmação | Movimentação `pending_confirmation` há > N dias | 🟠 | Caixa › Conciliação › não confirmadas |
| I1 | Extrato desatualizado | Conta com extrato sem importação há > N dias | ⚪ Aviso | Importação da conta |
| I2 | Orçamento estourando | Categoria com realizado + previsto do mês > X% do orçado | ⚪ Aviso | Planejamento › Orçamento |
| I3 | Fechamento pendente | Mês anterior `open` após o dia 10 | ⚪ Aviso | Checklist de fechamento |
| I4 | Reajustes próximos | Recorrências com reajuste nos próximos 30 dias | ⚪ Aviso | Recebimentos › Recorrências |

### 5.2 Anatomia de cada linha

- Ponto de cor da gravidade.
- **Título:** o que é + quanto. Exemplo: "R$ 8.450 em recebimentos vencidos".
- **Detalhe:** quantos e o mais relevante. Exemplo: "3 clientes. O mais antigo é Atlas Engenharia, há 12 dias".
- **Selo** de gravidade.
- **Destino** em texto + chevron. A linha inteira é clicável.

### 5.3 Regras

1. A ordem é **gravidade desc → valor desc**.
2. 🔴 e 🟠 aparecem sempre. ⚪ ficam recolhidos em "N avisos", expansíveis.
3. **🔴 e 🟠 não podem ser dispensados.** Só saem quando o problema é resolvido.
4. **⚪ podem ser silenciados por 7 dias**, por usuário. Grave `(user_id, exception_key, silenced_until)`, onde `exception_key` identifica o tipo + escopo (ex.: `I1:conta_sicoob`). Se a condição mudar de escopo (outra conta), o aviso reaparece.
5. A contagem no título do bloco considera apenas 🔴 e 🟠.
6. Uma mesma parcela pode aparecer em mais de uma exceção (ex.: vence amanhã e aguarda aprovação). Isso é esperado.
7. **Estado vazio** ("Tudo em dia"): quando não há 🔴 nem 🟠. Mostra a última conciliação e a próxima saída relevante (maior parcela `out` em aberto nos próximos 30 dias).

---

## 6. Bloco 2 — Pulso

São quatro cards, em grid de 4 colunas. Todos têm o "i" com a definição do dicionário de métricas.

| Card | Número principal | Contexto | Clique |
|---|---|---|---|
| **Saldo disponível** | Saldo disponível | "Cerca de X meses de fôlego" (Fôlego de caixa) | **Popover** com saldo por conta |
| **Caixa em 30 dias** | Saldo projetado em hoje + 30 | "Menor saldo: R$ X em dd/mm" (vermelho se abaixo da reserva) | Caixa › Fluxo |
| **Resultado do mês** | Resultado líquido do mês (competência) | Barra dividida realizado/previsto + "Margem de X%, sendo Y% já realizado" | Resultados › DRE |
| **MRR e pontual** | **MRR** (grande) + **Pontual do mês** (médio, ao lado) | Barra de proporção recorrente/pontual + "Total de R$ X. MRR ± R$ Y em 30 dias" | Resultados › Receita |

### 6.1 Popover do saldo

- Lista as contas com `counts_as_available = true`, com saldo e sinalizações:
  - "liquidez D+1" para contas do tipo `gateway`;
  - "extrato há N dias" quando a conta está desatualizada (mesma regra da I1).
- Mostra também as contas **fora do disponível** (reserva, investimento), em cinza.
- Tem o link "Ver contas no Caixa".

### 6.2 Card MRR e pontual

- **MRR:** métrica contratual (documento-mãe).
- **Pontual do mês:** Σ itens `operating_revenue` com competência no mês corrente em títulos **sem** `recurrence_id`.
- **Total:** receita do mês = MRR faturado + pontual. É a mesma métrica "Receita (período)".
- **Cores:** recorrente = cor de destaque do sistema; pontual = azul-claro. **As mesmas cores precisam ser usadas no Panorama › Composição da receita.**

### 6.3 Resultado do mês — barra dividida

- **Parte sólida:** itens do mês com parcela liquidada.
- **Parte hachurada:** itens do mês ainda em aberto.
- **Percentual realizado:** peso da parte realizada sobre o total do mês.

---

## 7. Bloco 3 — Entradas e saídas

**Frase do bloco:** "O ritmo do dinheiro: o que aconteceu na última semana, o que vem na próxima e o que ficou para trás."

Dois painéis lado a lado (**Recebimentos** | **Pagamentos**) com a mesma estrutura. O grid usa `align-items: start`, para que um painel aberto não estique o outro.

### 7.1 Parte sempre visível

| Elemento | Recebimentos | Pagamentos |
|---|---|---|
| Cabeçalho | "Recebimentos" + link "Abrir recebimentos" | "Pagamentos" + link "Abrir pagamentos" |
| % do mês | Σ principal baixado ÷ Σ parcelas `in` com vencimento no mês (exceto canceladas/renegociadas) | Idem para `out` |
| Barra de progresso | Recebido (verde) + vencido (vermelho) sobre o total | Pago (azul) + vencido (vermelho) sobre o total |
| Últimos 7 dias | Σ baixas `in` de hoje−7 a ontem + qtd | Σ baixas `out` + qtd |
| Próximos 7 dias | Σ saldo de parcelas `in` com vencimento de hoje a hoje+7 + qtd | Idem `out` |
| Vencido | Σ saldo vencido `in` + nº de clientes | Σ saldo vencido `out` + qtd + dias do mais antigo |

### 7.2 Parte expansível — botão "Ver composição"

Fica **recolhida por padrão**. Cada painel abre de forma independente, e o chevron gira ao abrir.

**Barra dia a dia (nos dois painéis):**
- 15 colunas: 7 dias passados + hoje + 7 dias futuros.
- Passado = baixas realizadas (barra preenchida). Hoje e futuro = parcelas previstas (barra só com contorno).
- A coluna de hoje tem fundo destacado. Dias sem valor mostram só a linha de base.
- A altura é proporcional ao maior valor **do próprio painel**.
- Legenda: data inicial, "hoje", data final.

**Recebimentos — parte de baixo:**
- **Vencidos por tempo de atraso:** 5 colunas de aging (1–7, 8–15, 16–30, 31–60, 60+ dias), com valor acima e barra proporcional. Faixa vazia mostra "—".
- **Próximo recebimento:** parcela `in` aberta com o menor vencimento ≥ hoje. Mostra pessoa, dia e valor + status da cobrança (enviada, visualizada, sem cobrança).
- **Atraso médio** e **Inadimplência 90d** (dicionário).

**Pagamentos — parte de baixo:**
- **Situação do que falta pagar:** barra empilhada + legenda com valores, somando todo o saldo `out` em aberto do mês:
  - **Programado:** tem `scheduled_payment_date`;
  - **Sem programação:** aberto, sem data programada, não vencido;
  - **Vencido**;
  - **Aguardando aprovação:** só se a regra estiver ligada.
- **Próximo pagamento:** parcela(s) `out` com o menor vencimento ≥ hoje. Se houver mais de uma no mesmo dia, agrupa: "Adobe e Google, hoje, R$ 820".
- **Pagos em dia 90d** (métrica nova, seção 12).
- **Maior saída prevista (30 dias):** a maior parcela `out` em aberto nos próximos 30 dias, com descrição e data.
  > No mockup o rótulo aparece como "Maior saída do mês". O rótulo correto é **"Maior saída prevista"**.

---

## 12. Métricas novas (incluir no dicionário do documento-mãe)

| Métrica | Definição | Base |
|---|---|---|
| **Saldo projetado (dia D)** | Saldo disponível hoje + Σ parcelas abertas `in` com vencimento (ou data programada) entre hoje e D − Σ parcelas abertas `out` no mesmo intervalo − **parcelas `out` já vencidas (contadas como saída hoje)**. **Parcelas `in` vencidas não entram.** Só contas que compõem o disponível | Vencimento |
| **Menor saldo projetado (30d)** | Mínimo do saldo projetado diário entre hoje e hoje+30, com a data em que ocorre | Vencimento |
| **Recebido/Pago últimos 7 dias** | Σ principal das baixas entre hoje−7 e ontem, por direção | Caixa |
| **A receber/pagar próximos 7 dias** | Σ saldo de parcelas abertas com vencimento de hoje a hoje+7, por direção | Vencimento |
| **Pontual do mês** | Σ itens `operating_revenue` com competência no mês, em títulos sem `recurrence_id` | Competência |
| **Pagos em dia (90d)** | Valor das parcelas `out` liquidadas até o vencimento ÷ valor total das parcelas `out` liquidadas nos últimos 90 dias | Caixa |
| **Maior saída prevista (30d)** | Maior parcela `out` em aberto com vencimento entre hoje e hoje+30 | Vencimento |
| **Saídas de resultado (mês)** | Deduções + custos diretos + despesas operacionais + resultado financeiro líquido negativo. É a barra cinza do Slide 3 e o total do Slide 4 | Competência |

---

## 13. Parâmetros configuráveis

Todos ficam em **Configurações Financeiras**, com os padrões abaixo. Ninguém precisa configurar nada para começar.

| Parâmetro | Padrão | Usado em |
|---|---|---|
| Reserva mínima de caixa | R$ 0 | E2, Slide 1 |
| Antecedência para alerta de cobrança não enviada | 5 dias | E5 |
| Dias sem extrato para aviso | 7 | I1, popover de saldo |
| Dias para baixa sem confirmação | 7 | E8 |
| Limite de conciliação pendente (qtd / dias) | 20 / 7 | E7 |
| Tolerância de orçamento | 110% | I2, Slide 4 |
| Dia a partir do qual o fechamento é cobrado | 10 | I3 |

---

## 14. Permissões

- O Dashboard é visível para **diretoria e perfis do Financeiro**.
- O CS **não acessa** esta página. Ele tem a área "Sua carteira" no módulo de CS (documento-mãe, seção 21).
- Ações do Dashboard (baixa, envio de cobrança, aprovação) respeitam as mesmas permissões das páginas de origem e geram **a mesma auditoria**. Não existe atalho sem registro.

---

## 15. Atualização de dados

- Carrega ao abrir a página.
- É **revalidada após qualquer ação** feita nela (baixa, envio de cobrança, silenciar aviso).
- **Realtime (Supabase):** webhooks do Asaas (pagamento, visualização de cobrança) atualizam em tempo real o Bloco 1, o Bloco 4, o card de Saldo e a faixa "Desde ontem".
- O horário "Atualizado às hh:mm" no Bloco 1 reflete o último cálculo.

---

## 17. Casos de borda (desta parte)

- **Conta com extrato desatualizado:** o saldo aparece, mas o popover sinaliza a conta. O número pode estar desatualizado, e o usuário precisa saber disso.
- **Início do mês:** o Resultado é quase todo previsto. A barra dividida e o percentual realizado deixam isso visível.
- **Mês com receita pontual grande:** o MRR não muda, mas o total e o resultado sobem. O card MRR e pontual deixa claro de onde veio.
- **Recorrência pausada no meio do mês:** sai do MRR imediatamente. Os títulos já gerados continuam no previsto até alguém decidir o que fazer com eles.
- **Resultado negativo:** o card fica em vermelho, **sem** gerar exceção. Prejuízo é análise, não tarefa do dia.
- **Vários pagamentos no mesmo dia como "próximo":** agrupar por nome até 2 pessoas; acima disso, "N contas, hoje".
- **Aging sem vencidos:** as colunas mostram "—" e a barra de base. A exceção E3 não aparece.
- **Fuso:** "hoje", "vencido" e "desde ontem" usam sempre `America/Sao_Paulo`.

Os casos "Conta sem saldo inicial" e "Slide sem dados" estão na Parte 2.
