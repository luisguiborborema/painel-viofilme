# Camada de Dados (dual-mode)

Como o painel busca dados sem que as telas saibam se estão em modo demo ou produção.

Pasta: [src/lib/data/](../src/lib/data/).

---

## 1. Padrão dual-mode

[queries.ts](../src/lib/data/queries.ts) é o **ponto de entrada único** de leitura. Cada função segue o padrão:

```ts
export async function getX(...) {
  if (isSupabaseConfigured()) return sb.sbGetX(...)   // banco real (com RLS)
  return MOCK_X                                        // dados de demonstração
}
```

- A **assinatura é idêntica** nos dois modos — páginas e componentes nunca sabem a origem.
- Modo demo usa mocks **determinísticos** (bom para prints e desenvolvimento offline).
- Produção delega para [supabase.ts](../src/lib/data/supabase.ts), que aplica RLS por usuário/cliente e faz os joins.

A decisão vem de `isSupabaseConfigured()` em [src/lib/supabase/config.ts](../src/lib/supabase/config.ts).

As **mutações** (criar/editar/mover) ficam nas rotas `src/app/api/*` (ver [APIS.md](APIS.md)); a camada `data/` é focada em leitura e tipos.

---

## 2. Arquivos

| Arquivo | Cobre |
|---------|-------|
| [queries.ts](../src/lib/data/queries.ts) | **Entry point dual-mode** — clientes, home do cliente, campanhas, conteúdo, séries de métricas, overview do cliente/agência, mídia paga, resultados orgânicos, financeiro, brand hub, C-Level, CRM, etc. |
| [supabase.ts](../src/lib/data/supabase.ts) | Implementações de leitura no Supabase (`sbGet*`) com escopo RLS e joins |
| [mock.ts](../src/lib/data/mock.ts) | Dados determinísticos de demonstração (clientes, campanhas, conteúdo, séries, reuniões, financeiro, data de referência) |
| [types.ts](../src/lib/data/types.ts) | Tipos compartilhados (Platform, Client, Campaign, ContentPost, AdCampaign, Invoice, Meeting, resultados agregados…) |
| [crm.ts](../src/lib/data/crm.ts) | CRM & vendas — estágios, deals, contatos, BANT, timeline de atividades |
| [cs.ts](../src/lib/data/cs.ts) | Customer Success — portfólio, health score, risco de churn, status de contrato |
| [operacao.ts](../src/lib/data/operacao.ts) | Operação/produção — hub de clientes, painel de entregas, VioLaunch (onboarding), relatórios por cliente |
| [gerfinance.ts](../src/lib/data/gerfinance.ts) | Financeiro gerencial — recebíveis, inadimplência, status de cobrança |
| [gestao-vista.ts](../src/lib/data/gestao-vista.ts) | Gestão à vista — equipes/squads, alocação, horas, capacidade |
| [rh.ts](../src/lib/data/rh.ts) | RH & cultura — funcionários, contratos, PDI, banco de horas, avaliações |
| [flux.ts](../src/lib/data/flux.ts) | VioFlux — estados de conteúdo (rascunho → agendado → publicado) |
| [inbox.ts](../src/lib/data/inbox.ts) | Inbox WhatsApp — conversas, status, mensagens, atribuição |
| [playbooks.ts](../src/lib/data/playbooks.ts) | Playbooks — setores e documentos em MD/HTML + anexos |
| [recurring.ts](../src/lib/data/recurring.ts) | Relatórios recorrentes — métricas agendadas, recorrência, disparo por cron |
| [reports.ts](../src/lib/data/reports.ts) | Resolver de relatórios — geração determinística de valores por cliente, formatação BRL |

---

## 3. Clientes Supabase

Definidos em [src/lib/supabase/](../src/lib/supabase/):

| Client | Arquivo | Uso |
|--------|---------|-----|
| Browser | [client.ts](../src/lib/supabase/client.ts) | Client Components (anon key, RLS) |
| Server | [server.ts](../src/lib/supabase/server.ts) | Server Components / Route Handlers / Actions (cookies) |
| Admin | [admin.ts](../src/lib/supabase/admin.ts) | Só servidor — service role, ignora RLS (webhooks, cron, Storage) |
| Middleware | [middleware.ts](../src/lib/supabase/middleware.ts) | Renova o token a cada request |

**Nunca** use o client admin no navegador — ele carrega a `SUPABASE_SERVICE_ROLE_KEY`.

Estrutura das tabelas em [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md).
