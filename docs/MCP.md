# MCP do Painel Viofilme

Servidor **MCP remoto** (Streamable HTTP) que expõe os dados do painel para o
Claude — claude.ai, Claude Code ou via API. **Somente leitura**: nenhuma
ferramenta cria, altera ou apaga nada.

- **Endpoint:** `https://<seu-app>/api/mcp`
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

```bash
curl -s https://<seu-app>/api/mcp -H "Authorization: Bearer $MCP_TOKEN"
```

Deve responder com o nome do servidor, a versão do protocolo e a lista de
ferramentas. Sem o token (ou com token errado) responde **401**.

## 3. Conectar

### Claude Code

```bash
claude mcp add --transport http painel https://<seu-app>/api/mcp \
  --header "Authorization: Bearer $MCP_TOKEN"
```

### claude.ai (conector personalizado)

Configurações → Conectores → Adicionar conector personalizado → URL do endpoint
e o header `Authorization: Bearer <MCP_TOKEN>`.

### API / código próprio

É JSON-RPC 2.0 por POST:

```bash
curl -s https://<seu-app>/api/mcp \
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
| `financial_summary` | MRR, recebido/em aberto/vencido e despesas por categoria |
| `list_payments` | Cobranças com status, valor e vencimento |
| `campaign_results` | Campanhas com investimento, impressões, cliques, conversões, CTR e CPA |
| `nps_summary` | NPS (promotores/neutros/detratores) e comentários recentes |
| `list_broadcasts` | Disparos de WhatsApp com taxa de entrega |

Onde uma ferramenta pede `client`, aceita **id, slug ou parte do nome**.

## 5. Exemplos de perguntas

- "Quais clientes estão com pagamento vencido?"
- "Resuma o funil comercial dos últimos 30 dias e a taxa de conversão."
- "Qual o NPS da carteira e o que os detratores comentaram?"
- "Quais entregas estão atrasadas e de quem são?"
- "Compare o CPA das campanhas do cliente X no último mês."

## Segurança

- O token é a única credencial — trate como senha. Para revogar, troque
  `MCP_TOKEN` na Vercel e refaça o deploy.
- O endpoint usa a service-role do Supabase, então **ignora RLS**: quem tem o
  token enxerga os dados de todos os clientes. Não compartilhe fora da equipe.
- Todas as ferramentas são marcadas como `readOnlyHint` no protocolo; não há
  nenhum caminho de escrita neste endpoint.
