# MCP do Painel Viofilme

Servidor **MCP remoto** (Streamable HTTP) que expõe os dados do painel para o
Claude — claude.ai, Claude Code ou via API. **Somente leitura**: nenhuma
ferramenta cria, altera ou apaga nada.

- **Endpoint:** `https://www.viofilme.com.br/api/mcp`
- **Autenticação:** header `Authorization: Bearer <MCP_TOKEN>`

## 1. Configurar o token

Gere um token forte (mínimo 16 caracteres — abaixo disso o endpoint fica
fechado por segurança):

```bash
openssl rand -hex 32
```

Adicione na Vercel (Project → Settings → Environment Variables):

```
MCP_TOKEN=<o token gerado>
```

Também é necessário `SUPABASE_SERVICE_ROLE_KEY` (já configurada — é a mesma que
os crons usam). Redeploy depois de salvar.

## 2. Conferir se está no ar

Sem token, para saber se as variáveis chegaram no servidor:

```bash
curl -s https://www.viofilme.com.br/api/mcp
```

```json
{ "configuracao": { "token": true, "banco": true }, "pronto": true }
```

`pronto: false` vem com a lista de `pendencias` dizendo o que falta. A resposta
informa apenas **se** as variáveis existem — nunca os valores.

Com o token, deve listar as ferramentas:

```bash
curl -s https://www.viofilme.com.br/api/mcp -H "Authorization: Bearer $MCP_TOKEN"
```

Token ausente ou errado responde **401**.

## 3. Conectar

### Claude Code

```bash
claude mcp add --transport http painel https://www.viofilme.com.br/api/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

### claude.ai (conector personalizado)

Configurações → Conectores → Adicionar conector personalizado → URL do endpoint
e o header `Authorization: Bearer <MCP_TOKEN>`.

### API / código próprio

É JSON-RPC 2.0 por POST:

```bash
curl -s https://www.viofilme.com.br/api/mcp \
  -H "Authorization: Bearer $MCP_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"pipeline_summary","arguments":{"days":30}}}'
```

## 4. Ferramentas disponíveis

| Ferramenta | O que traz |
|---|---|
| `search` | Busca o termo em clientes, negócios, empresas e contatos de uma vez |
| `list_clients` | Carteira de clientes com status, mensalidade e segmento |
| `get_client` | Ficha do cliente: serviços contratados (valores), contatos, entregáveis |
| `list_deliveries` | Tarefas do painel de entregas (filtra atrasadas, por cliente/responsável) |
| `list_deals` | Negócios do CRM (por funil, etapa, responsável, aberto/ganho/perdido) |
| `get_deal` | Negócio completo com empresa, interações e tarefas |
| `pipeline_summary` | Funil por etapa (quantidade e valor) + ganhos/perdidos e conversão |
| `campaign_results` | Campanhas com investimento, impressões, cliques, conversões, CTR e CPA |
| `nps_summary` | NPS (promotores/neutros/detratores) e comentários recentes |
| `list_broadcasts` | Disparos de WhatsApp com taxa de entrega |

### Financeiro

| Ferramenta | O que traz |
|---|---|
| `financial_summary` | MRR, recebido/em aberto/vencido e despesas por categoria |
| `dre` | Demonstrativo do período com comparativo — em regime de **competência** (pelo vencimento) ou **caixa** (pelo pagamento) |
| `financial_indicators` | Prazo médio de recebimento (DSO), ticket médio, % de receita recorrente, inadimplência |
| `aging_receivables` | Vencido por faixa de idade (1–30, 31–60, 61–90, +90) e maiores devedores |
| `overdue_details` | Cada título vencido com dias de atraso e encargos pela regra configurada |
| `budget_vs_actual` | Orçado × realizado por categoria, com o desvio |
| `cashflow_forecast` | Projeção semanal a partir do saldo real das contas |
| `reconciliation_status` | Quanto do extrato bancário já foi conferido, por conta |
| `list_payments` | Cobranças com status, valor e vencimento |

Onde uma ferramenta pede `client`, aceita **id, slug ou parte do nome**.

Respostas que somam muitos lançamentos trazem `incompleto: true` quando os
dados passaram do teto de leitura. **Se esse campo vier verdadeiro, o total não
é o total** — reduza o período antes de concluir qualquer coisa.

## 5. Exemplos de perguntas

- "Quais clientes estão com pagamento vencido?"
- "Resuma o funil comercial dos últimos 30 dias e a taxa de conversão."
- "Qual o NPS da carteira e o que os detratores comentaram?"
- "Quais entregas estão atrasadas e de quem são?"
- "Compare o CPA das campanhas do cliente X no último mês."
- "Monte o DRE do trimestre em regime de caixa e explique a diferença para o de competência."
- "Quanto está vencido há mais de 90 dias e de quem?"
- "Em que semana meu caixa fica negativo?"
- "Onde estourei o orçamento este mês?"
- "O extrato do banco já está todo conferido?"

## Segurança

- O token é a única credencial — trate como senha. Para revogar, troque
  `MCP_TOKEN` na Vercel e refaça o deploy.
- O endpoint usa a service-role do Supabase, então **ignora RLS**: quem tem o
  token enxerga os dados de todos os clientes. Não compartilhe fora da equipe.
- Todas as ferramentas são marcadas como `readOnlyHint` no protocolo; não há
  nenhum caminho de escrita neste endpoint. O teste `tests/mcp.test.ts` varre
  `tools.ts` atrás de `insert`/`update`/`upsert`/`delete`/`rpc` e falha se
  alguma aparecer — a garantia de "somente leitura" não depende de revisão.

## O que ainda não foi verificado

O protocolo foi testado de ponta a ponta (autenticação, `initialize`,
`tools/list`, `tools/call`, lote, notificação, erros). O **caminho de dados**
não: exige a `SUPABASE_SERVICE_ROLE_KEY`, que só existe em produção. Se as
ferramentas responderem *"Servidor sem SUPABASE_SERVICE_ROLE_KEY"*, é essa
variável que falta na Vercel — não o token.
