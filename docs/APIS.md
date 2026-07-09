# APIs do Painel Viofilme

Documento de referência de **todas as APIs** usadas no sistema — tanto os **serviços externos consumidos** (Supabase, Meta, Google, OpenAI, Asaas, WhatsApp/Uazapi, Web Push) quanto as **rotas internas** (`/api/*`) que o painel expõe.

> **Modo Demo:** sem as variáveis de ambiente configuradas (principalmente Supabase), o painel roda em **modo demonstração** com dados simulados. Cada integração degrada graciosamente para um _fallback_ quando sua chave não está presente. Veja [`.env.example`](../.env.example) para o guia de configuração.

---

## Índice

1. [Serviços externos consumidos](#1-serviços-externos-consumidos)
   - [Supabase](#11-supabase-autenticação--banco--storage)
   - [Meta Graph API](#12-meta-graph-api-instagram--facebook)
   - [Google Calendar API](#13-google-calendar-api)
   - [OpenAI](#14-openai-ia-bruna--insights)
   - [Asaas](#15-asaas-financeiro--pagamentos)
   - [WhatsApp — Uazapi](#16-whatsapp--uazapi)
   - [Web Push / VAPID](#17-web-push--vapid)
2. [Rotas internas da API (`/api/*`)](#2-rotas-internas-da-api-api)
3. [Cron jobs (Vercel)](#3-cron-jobs-vercel)
4. [Resumo das variáveis de ambiente](#4-resumo-das-variáveis-de-ambiente)

---

## 1. Serviços externos consumidos

### 1.1 Supabase (autenticação + banco + storage)

Backbone de dados, login e armazenamento de arquivos. Código em [`src/lib/supabase/`](../src/lib/supabase/).

| Client | Arquivo | Pacote | Chave usada | Escopo |
|--------|---------|--------|-------------|--------|
| **Browser** | [client.ts](../src/lib/supabase/client.ts) | `@supabase/ssr` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client Components (navegador), RLS aplicado |
| **Server** | [server.ts](../src/lib/supabase/server.ts) | `@supabase/ssr` | anon key + cookies | Server Components, Route Handlers, Server Actions |
| **Admin** | [admin.ts](../src/lib/supabase/admin.ts) | `@supabase/supabase-js` | `SUPABASE_SERVICE_ROLE_KEY` | Só servidor — sync, cron, uploads no Storage (ignora RLS) |
| **Middleware** | [middleware.ts](../src/lib/supabase/middleware.ts) | `@supabase/ssr` | — | Renova o token via `getClaims()` em cada request |

- **Autenticação:** Supabase Auth (e-mail/senha). Em modo demo usa login simulado ([`src/lib/auth/demo.ts`](../src/lib/auth/demo.ts)).
- **Banco:** tabelas de métricas sincronizadas da Meta (`account_metrics`, `content_posts`, `campaigns`, `campaign_metrics`) + tabelas da agência (`clients`, `meetings`, CRM `crm_*`, `wa_conversations`, `wa_messages`, `push_subscriptions`, `google_connections`, `asaas_webhook_events`, etc.).
- **Storage:** buckets públicos `wa-media` (mídia do WhatsApp) e `playbook-files` (anexos) — escrita via client admin.
- **Detecção de modo:** `isSupabaseConfigured()` em [config.ts](../src/lib/supabase/config.ts) valida URL + tamanho da chave. URL inválida/ausente → modo demo.

**Env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ou `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`), `SUPABASE_SERVICE_ROLE_KEY`.

---

### 1.2 Meta Graph API (Instagram + Facebook)

Coleta de métricas orgânicas (Instagram) e de anúncios (Facebook Ads). Código em [`src/lib/meta/`](../src/lib/meta/).

- **Base URL:** `https://graph.facebook.com/{version}` — versão `v21.0` (`META_GRAPH_VERSION`)
- **OAuth:**
  - Authorize: `https://www.facebook.com/{version}/dialog/oauth`
  - Token: `GET /oauth/access_token` (troca `code` → token curto → token longo ~60 dias)
  - Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/meta/callback`
- **Escopos:** `public_profile`, `pages_show_list`, `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`, `read_insights`, `ads_read`

**Endpoints consumidos:**

| Endpoint | Método | Para quê |
|----------|--------|----------|
| `/oauth/access_token` | GET | Troca code por token e estende para longa duração |
| `/me/accounts` | GET | Páginas do Facebook + conta Instagram vinculada |
| `/{igUserId}` | GET | Dados da conta IG (seguidores, nº de mídias, foto) |
| `/{igUserId}/media` | GET | Mídias recentes (feed, reels, stories) |
| `/{mediaId}/insights` | GET | Métricas por post (reach, saved, shares) |
| `/{igUserId}/insights` | GET | Insights da conta por período (reach, impressions, profile_views) |
| `/me/adaccounts` | GET | Contas de anúncio administradas |
| `/{adAccountId}/campaigns` | GET | Campanhas da conta de anúncio |
| `/{adAccountId}/insights` | GET | Insights diários (spend, impressions, reach, clicks, conversions) |

**Sincronização:** [`src/lib/meta/sync.ts`](../src/lib/meta/sync.ts) grava tudo no Supabase. Disparada pelo cron diário (`/api/meta/sync`) ou manualmente por cliente.

**Env vars:** `NEXT_PUBLIC_META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`.

---

### 1.3 Google Calendar API

Agenda da agência — cria eventos (com Google Meet) e lê a agenda. Código em [`src/lib/google/`](../src/lib/google/).

- **Base URL:** `https://www.googleapis.com/calendar/v3`
- **OAuth:**
  - Authorize: `https://accounts.google.com/o/oauth2/v2/auth` (`access_type=offline` para obter refresh token)
  - Token / Refresh: `POST https://oauth2.googleapis.com/token`
  - Revoke: `POST https://oauth2.googleapis.com/revoke`
  - Userinfo: `GET https://www.googleapis.com/oauth2/v2/userinfo`
  - Redirect URI: `{NEXT_PUBLIC_APP_URL}/api/google/callback`
- **Escopos:** `openid`, `email`, `https://www.googleapis.com/auth/calendar`

**Endpoints consumidos:**

| Endpoint | Método | Para quê |
|----------|--------|----------|
| `/users/me/calendarList` | GET | Lista calendários da conta |
| `/calendars/{calendarId}/events` | GET | Próximos eventos (paginado, filtro de data) |
| `/calendars/{calendarId}/events` | POST | Cria evento (com `conferenceData` → link do Meet) |

**Tokens** salvos na tabela `google_connections` (scope `agency`). Refresh automático 60s antes de expirar.

**Env vars:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID` (padrão `primary`), `NEXT_PUBLIC_APP_URL`.

---

### 1.4 OpenAI (IA Bruna + insights)

Assistente conversacional e geração automática de insights. Usa o SDK `openai`.

- **Base URL:** `https://api.openai.com/v1`
- **Autenticação:** `Authorization: Bearer <OPENAI_API_KEY>` (via SDK)
- **Modelo:** `OPENAI_MODEL` (padrão `gpt-4o-mini`)

| Rota | Endpoint | Configuração | Uso |
|------|----------|--------------|-----|
| [`/api/chat`](../src/app/api/chat/route.ts) | `POST /chat/completions` | `stream: true`, `max_tokens: 1024`, `temperature: 0.5` | Chat da **Bruna** (cliente) e **Cadu** (equipe) — respostas em streaming |
| [`/api/insights`](../src/app/api/insights/route.ts) | `POST /chat/completions` | `response_format: json_object`, `max_tokens: 1500`, `temperature: 0.4` | Insights de campanhas, social orgânico e padrões de posts |

Sem `OPENAI_API_KEY`, ambas as rotas retornam mensagens de _fallback_ estáticas.

**Env vars:** `OPENAI_API_KEY`, `OPENAI_MODEL`.

---

### 1.5 Asaas (financeiro / pagamentos)

Recebe eventos de cobrança via **webhook de entrada**. Config em [`src/lib/asaas/config.ts`](../src/lib/asaas/config.ts).

- **Base URL:** `https://api.asaas.com/v3` (produção) / `https://api-sandbox.asaas.com/v3` (sandbox) — definido por `ASAAS_ENV`
- **Webhook (ENTRADA):** [`POST /api/webhooks/asaas`](../src/app/api/webhooks/asaas/route.ts)
  - **Autenticação:** header `asaas-access-token` comparado com `ASAAS_WEBHOOK_TOKEN` (comparação constant-time)
  - **Eventos:** `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED_IN_CASH`, `PAYMENT_OVERDUE`
  - **Ação:** grava pagamento, notifica o cliente via Push + WhatsApp. Idempotência via tabela `asaas_webhook_events`.
- **Chamadas de saída (`ASAAS_API_KEY`):** previstas para consulta/backfill — ainda não implementadas.

**Env vars:** `ASAAS_WEBHOOK_TOKEN`, `ASAAS_API_KEY`, `ASAAS_ENV`.

---

### 1.6 WhatsApp — Uazapi

Envio e recebimento de mensagens WhatsApp (inbox ao vivo + alertas internos). Código em [`src/lib/whatsapp/`](../src/lib/whatsapp/).

- **Base URL:** `UAZAPI_URL` (ex.: `https://xxxx.uazapi.com`)
- **Autenticação (saída):** header `token: <UAZAPI_TOKEN>`

**Chamadas de SAÍDA:**

| Endpoint | Método | Para quê |
|----------|--------|----------|
| `/send/text` | POST | Enviar texto — `{ number, text }` |
| `/send/media` | POST | Enviar mídia — `{ number, type, file, text?, docName? }` |
| `/message/download` | POST | Baixar/decodificar mídia recebida (base64) |

**Webhook (ENTRADA):** [`POST /api/webhooks/uazapi`](../src/app/api/webhooks/uazapi/route.ts)
- **Autenticação:** `?secret=` na URL **ou** campo `token` no corpo, comparado com `UAZAPI_WEBHOOK_SECRET` (opcional — vazio desativa a validação)
- **Ação:** espelha mensagens no inbox (`wa_conversations` + `wa_messages`), baixa mídia e associa a leads do CRM.

**Env vars:** `UAZAPI_URL`, `UAZAPI_TOKEN`, `UAZAPI_WEBHOOK_SECRET`, `UAZAPI_NOTIFY_NUMBERS`.

---

### 1.7 Web Push / VAPID

Notificações push para os navegadores dos usuários. Usa a biblioteca `web-push` + Service Worker ([`public/sw.js`](../public/sw.js)). Código em [`src/lib/push/`](../src/lib/push/).

- **Autenticação:** VAPID (par de chaves pública/privada), `subject` = `NEXT_PUBLIC_APP_URL` (padrão `mailto:contato@viofilme.com.br`)
- **Envio:** `webpush.sendNotification(subscription, payload)` — payload `{ title, body, icon, data: { url } }`
- **Subscriptions** armazenadas na tabela `push_subscriptions`.

**Gatilhos** ([`triggers.ts`](../src/lib/push/triggers.ts)) — cada um dispara Push **e** WhatsApp: aprovação de conteúdo, relatório pronto, lembrete de reunião, cobrança/pagamento, risco de churn, tarefas atrasadas, banco de horas excedido, solicitações do portal, falha em update recorrente.

**Env vars:** `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_APP_URL`.

---

## 2. Rotas internas da API (`/api/*`)

Rotas Next.js Route Handlers. Salvo indicação em contrário, exigem sessão `gerencial`; algumas exigem acesso total (Gestor) e/ou o client admin (service-role). Degradação graciosa quando o Supabase não está configurado.

### CRM — `/api/crm/*`

| Rota | Métodos | Propósito |
|------|---------|-----------|
| [`/api/crm/leads`](../src/app/api/crm/leads/route.ts) | POST | CRUD de negócios + mover de estágio, trocar pipeline (com automações e rodízio de owner) |
| [`/api/crm/pipelines`](../src/app/api/crm/pipelines/route.ts) | POST | CRUD de funis (create/rename/delete/set-default) com seed de estágios |
| [`/api/crm/stages`](../src/app/api/crm/stages/route.ts) | POST | CRUD e reordenação de estágios (kind open/won/lost) |
| [`/api/crm/companies`](../src/app/api/crm/companies/route.ts) | POST | Cria/deleta empresa |
| [`/api/crm/contacts`](../src/app/api/crm/contacts/route.ts) | POST | Cria/deleta contato |
| [`/api/crm/deal-contacts`](../src/app/api/crm/deal-contacts/route.ts) | POST | Associa contatos a negócio (add/remove/setPrimary) |
| [`/api/crm/object`](../src/app/api/crm/object/route.ts) | POST | Atualiza propriedades customizadas (merge jsonb), tags e campos nativos |
| [`/api/crm/properties`](../src/app/api/crm/properties/route.ts) | POST | CRUD das **definições** de propriedades customizadas |
| [`/api/crm/tags`](../src/app/api/crm/tags/route.ts) | POST | CRUD de tags |
| [`/api/crm/tasks`](../src/app/api/crm/tasks/route.ts) | POST | Cria/conclui/reabre tarefas (próxima ação) |
| [`/api/crm/task-flows`](../src/app/api/crm/task-flows/route.ts) | POST | Fluxos de tarefas/playbooks (create/add-step/apply/…) |
| [`/api/crm/interactions`](../src/app/api/crm/interactions/route.ts) | POST | Registra interação na timeline; opcionalmente envia WhatsApp real |
| [`/api/crm/schedule`](../src/app/api/crm/schedule/route.ts) | POST | Agenda reunião: cria evento no Google + Meet, move lead, cria tarefa/interação |
| [`/api/crm/win`](../src/app/api/crm/win/route.ts) | POST | Marca lead como Ganho e cria cliente real |
| [`/api/crm/goals`](../src/app/api/crm/goals/route.ts) | POST | Upsert de meta de vendedor por mês (acesso total) |
| [`/api/crm/merge`](../src/app/api/crm/merge/route.ts) | POST | Mescla duplicados (empresa/contato) |
| [`/api/crm/import`](../src/app/api/crm/import/route.ts) | POST | Importa negócios em lote via CSV |
| [`/api/crm/capture-forms`](../src/app/api/crm/capture-forms/route.ts) | POST | CRUD de formulários de captura |
| [`/api/crm/proposal`](../src/app/api/crm/proposal/route.ts) | POST | Gera proposta em PDF (download) ou envia por WhatsApp |

### Gerencial — `/api/gerencial/*`

| Rota | Métodos | Propósito |
|------|---------|-----------|
| [`/api/gerencial/team`](../src/app/api/gerencial/team/route.ts) | POST | Gestão de usuários gerenciais (criar/editar/reset senha/ativar) — Gestor + service-role |
| [`/api/gerencial/client-config`](../src/app/api/gerencial/client-config/route.ts) | POST | Config do cliente (tráfego pago, tipo, redes, asaas_customer_id, whatsapp) |
| [`/api/gerencial/client-goals`](../src/app/api/gerencial/client-goals/route.ts) | GET, POST | Metas mensais de um cliente (leitura/upsert) |
| [`/api/gerencial/playbooks`](../src/app/api/gerencial/playbooks/route.ts) | POST | CRUD de setores/playbooks e anexos |
| [`/api/gerencial/playbooks/upload`](../src/app/api/gerencial/playbooks/upload/route.ts) | POST | Upload de anexos de playbook (Storage) |
| [`/api/gerencial/recurring-updates`](../src/app/api/gerencial/recurring-updates/route.ts) | GET, POST | Updates recorrentes (automação de envio de relatórios) |

### Inbox — `/api/inbox/*`

| Rota | Métodos | Propósito |
|------|---------|-----------|
| [`/api/inbox/conversations`](../src/app/api/inbox/conversations/route.ts) | GET | Lista de conversas com filtros (polling) |
| [`/api/inbox/messages`](../src/app/api/inbox/messages/route.ts) | GET | Mensagens de uma conversa; zera unread |
| [`/api/inbox/send`](../src/app/api/inbox/send/route.ts) | POST | Envia texto pelo painel (Uazapi + grava histórico) |
| [`/api/inbox/send-media`](../src/app/api/inbox/send-media/route.ts) | POST | Envia mídia pelo painel (Uazapi + grava histórico) |
| [`/api/inbox/upload`](../src/app/api/inbox/upload/route.ts) | POST | Upload de arquivo para bucket `wa-media` |
| [`/api/inbox/assign`](../src/app/api/inbox/assign/route.ts) | POST | Atribui atendente e/ou muda status |
| [`/api/inbox/debug`](../src/app/api/inbox/debug/route.ts) | GET | Diagnóstico do webhook (últimas 20 chamadas) |

### Integrações — Meta / Google / WhatsApp / Push

| Rota | Métodos | Propósito |
|------|---------|-----------|
| [`/api/meta/connect`](../src/app/api/meta/connect/route.ts) | GET | Inicia OAuth da Meta |
| [`/api/meta/callback`](../src/app/api/meta/callback/route.ts) | GET | Callback OAuth (token de longa duração) |
| [`/api/meta/sync`](../src/app/api/meta/sync/route.ts) | GET, POST | Cron (todos) / manual (um cliente) — sincroniza métricas |
| [`/api/google/connect`](../src/app/api/google/connect/route.ts) | GET | Inicia OAuth do Google |
| [`/api/google/callback`](../src/app/api/google/callback/route.ts) | GET | Callback OAuth (salva tokens) |
| [`/api/google/calendars`](../src/app/api/google/calendars/route.ts) | GET | Lista calendários + config atual |
| [`/api/google/settings`](../src/app/api/google/settings/route.ts) | POST | Define calendários de criação/exibição |
| [`/api/google/disconnect`](../src/app/api/google/disconnect/route.ts) | POST | Desconecta (revoga token + apaga conexão) |
| [`/api/whatsapp/test`](../src/app/api/whatsapp/test/route.ts) | POST | Envia mensagem de teste aos números de alerta |
| [`/api/push/subscribe`](../src/app/api/push/subscribe/route.ts) | POST | Registra subscription de push do navegador |
| [`/api/push/unsubscribe`](../src/app/api/push/unsubscribe/route.ts) | POST | Remove subscription |
| [`/api/push/test`](../src/app/api/push/test/route.ts) | POST | Envia notificação de teste |

### Webhooks (entrada) e outros

| Rota | Métodos | Propósito |
|------|---------|-----------|
| [`/api/webhooks/asaas`](../src/app/api/webhooks/asaas/route.ts) | POST | Webhook de pagamentos do Asaas |
| [`/api/webhooks/uazapi`](../src/app/api/webhooks/uazapi/route.ts) | POST | Webhook de mensagens do WhatsApp (Uazapi) |
| [`/api/cron/notifications`](../src/app/api/cron/notifications/route.ts) | GET | Cron diário — lembretes de reunião, updates recorrentes, tarefas atrasadas, alertas (Bearer `CRON_SECRET`) |
| [`/api/reports/send`](../src/app/api/reports/send/route.ts) | GET, POST | Histórico / envio manual de relatório por WhatsApp (PDF) |
| [`/api/requests`](../src/app/api/requests/route.ts) | POST | Solicitações do portal (reunião/conteúdo) → notifica gerencial |
| [`/api/notify`](../src/app/api/notify/route.ts) | POST | Disparo de notificações por evento da UI |
| [`/api/le/pdf`](../src/app/api/le/pdf/route.ts) | GET | Exporta Linha Editorial em PDF |
| [`/api/insights`](../src/app/api/insights/route.ts) | POST | Geração de insights via OpenAI |
| [`/api/chat`](../src/app/api/chat/route.ts) | POST | Chat da IA (Bruna/Cadu) via OpenAI |
| [`/api/public/lead`](../src/app/api/public/lead/route.ts) | OPTIONS, POST | **Pública** — captura de lead via formulário externo (CORS + honeypot) |

---

## 3. Cron jobs (Vercel)

Configurados em [`vercel.json`](../vercel.json), autenticados com `Bearer <CRON_SECRET>`:

| Rota | Agenda | Função |
|------|--------|--------|
| `/api/meta/sync` | `0 6 * * *` (06:00 diário) | Sincroniza métricas da Meta para todos os clientes |
| `/api/cron/notifications` | `0 11 * * *` (11:00 diário) | Lembretes de reunião, updates recorrentes, tarefas atrasadas, alertas |

---

## 4. Resumo das variáveis de ambiente

| Serviço | Variáveis |
|---------|-----------|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Meta** | `NEXT_PUBLIC_META_APP_ID`, `META_APP_SECRET`, `META_GRAPH_VERSION`, `NEXT_PUBLIC_APP_URL` |
| **Google** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID` |
| **OpenAI** | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| **Asaas** | `ASAAS_WEBHOOK_TOKEN`, `ASAAS_API_KEY`, `ASAAS_ENV` |
| **WhatsApp (Uazapi)** | `UAZAPI_URL`, `UAZAPI_TOKEN`, `UAZAPI_WEBHOOK_SECRET`, `UAZAPI_NOTIFY_NUMBERS` |
| **Web Push** | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` |
| **Cron** | `CRON_SECRET`, `NOTIFY_MOCK_ALERTS` |

> Detalhes de cada variável em [`.env.example`](../.env.example).
