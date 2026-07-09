# Referência da API de Integrações

Rotas que conectam o painel a serviços externos: **Meta** (OAuth + sync), **Google Calendar** (OAuth + config), os **webhooks de entrada** (Asaas, Uazapi) e o teste de WhatsApp. Para os endpoints externos consumidos (base URLs, escopos), ver [APIS.md](APIS.md).

> **Dois tipos de rota aqui:**
> - **OAuth (GET, redirect):** `connect`/`callback` **não retornam JSON** — redirecionam o navegador (para o provedor ou de volta a `/gerencial/integracoes?...`). Exigem sessão gerencial (senão redirecionam a `/login`).
> - **Webhooks (POST, entrada):** chamados **pelo provedor**, não pela UI. Autenticam por **token do próprio provedor** (não por sessão).

---

## Meta (Instagram + Facebook)

### `GET /api/meta/connect` — iniciar OAuth
Inicia a conexão da conta de um cliente. **Query:** `client=<clientId>` (obrigatório). Gera `state` anti-CSRF (cookie `meta_oauth_state`) e redireciona para o diálogo OAuth da Meta.

**Redirects de erro:** `?erro=cliente` (sem client), `?erro=config` (Meta não configurada), `/login` (sem sessão).

### `GET /api/meta/callback` — callback OAuth
**Query:** `code`, `state` (da Meta). Valida o `state` contra o cookie, troca o code por token de **longa duração**, descobre a página/Instagram e faz upsert em `meta_connections`.

**Redirect de sucesso:** `?ok=<nome da página>`. **Erros:** `?erro=negado|invalido|state|sem_pagina|<msg>`.

### `/api/meta/sync` — sincronizar métricas
Dois modos:

| Método | Quem chama | Auth | O que faz |
|--------|-----------|------|-----------|
| `GET` | Vercel Cron | `Authorization: Bearer <CRON_SECRET>` | Sincroniza **todos** os clientes → `{ ok, count, results }` |
| `POST` | Painel (gerencial) | Sessão | Sincroniza **um** cliente (`?client=<id>`) → `{ ok, result }` |

**Erros:** `401` (secret/sessão inválidos), `400 informe ?client=<clientId>` (POST sem client), `503 Supabase não configurado` / `503 SUPABASE_SERVICE_ROLE_KEY ausente`, `500` (falha no sync). `maxDuration` = 300s.

---

## Google Calendar

### `GET /api/google/connect` — iniciar OAuth
Conta **única da agência**. Gera `state` (cookie `google_oauth_state`) e redireciona ao consentimento Google (`access_type=offline` para obter refresh token). Erro: `?gerro=config`.

### `GET /api/google/callback` — callback OAuth
**Query:** `code`, `state`. Valida o `state`, troca o code, descobre o e-mail e salva os tokens (`saveConnection`). Sucesso: `?gok=<email>`. Erros: `?gerro=negado|invalido|state|<msg>`.

### `GET /api/google/calendars` — listar calendários
**Sucesso `200`:** `{ calendars:[...], writeCalendarId, readCalendarIds:[...] }` (config atual). **Erro:** `401`.

### `POST /api/google/settings` — salvar seleção
**Corpo:** `{ "writeCalendarId": "primary", "readCalendarIds": ["id1","id2"] }` (calendário de criação + calendários exibidos na agenda).
**Sucesso `200`:** `{ ok }` · **Erros:** `400 JSON inválido`, `500 não foi possível salvar`.

### `POST /api/google/disconnect` — desconectar
Revoga o token e apaga a conexão. **Sucesso:** `{ ok }` · **Erro:** `500 não foi possível desconectar`.

> A criação de eventos (com Meet) a partir do CRM é a rota [`/api/crm/schedule`](API-CRM.md#217-apicrmschedule--agendar-reunião-google--dependências).

---

## Webhook Asaas (financeiro) — entrada

### `POST /api/webhooks/asaas`
Chamado **pelo Asaas** a cada evento de cobrança. **Auth:** header `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN` (comparação constant-time).

**Payload (do Asaas):** `{ id, event, payment:{ id, customer, status, billingType, value, netValue, dueDate, paymentDate, invoiceUrl, externalReference, ... } }`.

Fluxo: valida token → resolve o cliente (por `externalReference` = nosso `client_id`, senão por `asaas_customer_id`) → **upsert** em `payments` → notifica o cliente (Push + WhatsApp) nos eventos `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED` / `PAYMENT_RECEIVED_IN_CASH` / `PAYMENT_OVERDUE`. **Idempotente** via `asaas_webhook_events`.

| Situação | HTTP | Corpo |
|----------|------|-------|
| Processado | `200` | `{ ok:true }` |
| Reenvio já visto | `200` | `{ ok:true, duplicate:true }` |
| Sem `event` | `200` | `{ ok:true, ignored:true }` |
| Token inválido | `401` | `{ error:"não autorizado" }` |
| JSON inválido | `400` | `{ error:"JSON inválido" }` |
| Banco indisponível | `503` | `{ error:"armazenamento indisponível" }` — Asaas reenvia |
| Erro ao gravar | `500` | `{ error:<msg> }` — Asaas reenvia |

---

## Webhook Uazapi (WhatsApp) — entrada

### `POST /api/webhooks/uazapi`
Chamado **pelo Uazapi** a cada mensagem. **Auth:** `?secret=<UAZAPI_WEBHOOK_SECRET>` na URL **ou** o campo `token` no corpo. Se `UAZAPI_WEBHOOK_SECRET` está vazio, **não valida** (aceita tudo).

Normaliza formatos Uazapi/Baileys, ignora grupos e ecos da própria API, espelha as mensagens no inbox (`wa_conversations` + `wa_messages`), **baixa a mídia** recebida e a re-hospeda no Storage (`wa-media`), e associa a conversa a um lead do CRM (match pelo fim do telefone).

| Situação | HTTP | Corpo |
|----------|------|-------|
| Processado | `200` | `{ ok:true, results:[...] }` |
| Sem JSON / sem mensagem | `200` | `{ ok:true, ignored:"no-json"\|"no-message" }` |
| Secret inválido | `401` | `{ error:"unauthorized" }` |

Toda chamada é registrada em `wa_webhook_log` (visível em [`/api/inbox/debug`](API-INBOX.md#get-apiinboxdebug--diagnóstico-do-webhook)). Sempre responde `200` nos casos ignorados para o Uazapi não reenviar.

---

## Teste de WhatsApp

### `POST /api/whatsapp/test`
Envia um WhatsApp de teste. Sessão gerencial. **Corpo (opcional):** `{ "number": "5527999998888" }` — sem número, usa `UAZAPI_NOTIFY_NUMBERS`.

**Sucesso `200`:** `{ ok, sent:<quantidade> }`.
**Erros:** `503 Uazapi não configurado`, `400 sem número de destino`.
