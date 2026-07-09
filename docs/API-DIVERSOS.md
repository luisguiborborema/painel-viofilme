# Referência das demais rotas da API

Rotas que não se encaixam nos grupos CRM/Inbox/Gerencial/Integrações: **IA** (chat, insights), **notificações** (notify, push, cron), **solicitações do portal**, **relatórios/PDF** e o **endpoint público de captura de leads**. Convenções gerais em [API-CRM.md](API-CRM.md#1-convenções-comuns), mas **atenção**: várias rotas aqui fogem do padrão (streaming, PDF binário, sem sessão, público com CORS).

---

## IA (OpenAI)

### `POST /api/chat` — chat Bruna/Cadu ⚠️ streaming, não-JSON
Chat com IA: **Bruna** para o cliente, **Cadu** para a equipe (decidido pelo papel da sessão). A **resposta é um stream de texto** (`text/plain`), consumido incrementalmente — **não** é JSON.

- **Auth:** sessão. Cliente precisa de `clientId`.
- **Corpo:** `{ "messages": [{ "role": "user"|"assistant", "content": "..." }] }` (as últimas 16 são usadas; a última precisa ser `user`).
- **Sem `OPENAI_API_KEY`:** responde uma mensagem de **fallback** (mesmo canal de streaming) — não dá erro.
- **Erros (texto puro):** `401 Não autenticado` / `Sem cliente vinculado`, `400 JSON inválido` / `Mensagem do usuário ausente`.

O contexto real do cliente/agência é injetado no system prompt (`getClientAiContext` / `getAgencyAiContext`). Modelo: `OPENAI_MODEL` (padrão `gpt-4o-mini`), `temperature 0.5`, `max_tokens 1024`.

### `POST /api/insights` — insights por IA
Gera 2–4 insights estruturados em JSON. **Não exige sessão** — só depende da `OPENAI_API_KEY`.

- **Corpo:** `{ "mode": "campaigns"|"organic"|"common-posts", "businessType": "varejo", "data": { ... } }`.
- **Sucesso `200`:** `{ "insights": [{ type, title, text, action? }] }`. O `type` é um enum por `mode` (ex.: campaigns → `positivo|atencao|oportunidade|orcamento`).
- **Erros:** `503 OPENAI_API_KEY não configurada`, `400 JSON inválido` / `mode inválido`, `500` (falha na IA).

---

## Notificações

### `POST /api/notify` — disparo por evento da UI
Dispara notificações (Push + WhatsApp) conforme o evento, validado por papel.

| `event` | Papel | Campos | Dispara |
|---------|-------|--------|---------|
| `content_decision` | cliente | `decision` (`approved`/`changes`), `title` | Avisa a equipe da decisão do cliente |
| `report_ready` | gerencial | `clientId`, `period` | Avisa o cliente que o relatório saiu |
| `content_ready` | gerencial | `clientId`, `title` | Avisa o cliente que há conteúdo p/ aprovar |

**Sucesso `200`:** `{ ok }`. **Erros:** `401 não autenticado`, `403 não permitido` (papel errado), `400 evento inválido`, `500 falha ao notificar`.

### `POST /api/push/subscribe` — registrar push
**Corpo:** `{ "subscription": { "endpoint", "keys": { "p256dh", "auth" } } }` (objeto `PushSubscription` do navegador). Faz upsert em `push_subscriptions`.
**Sucesso:** `{ ok, persisted }` · **Erros:** `401`, `400 inscrição inválida`.

### `POST /api/push/unsubscribe` — remover push
**Corpo:** `{ "endpoint": "https://..." }`. **Sucesso:** `{ ok }` · **Erros:** `401`, `400 endpoint ausente`.

### `POST /api/push/test` — notificação de teste
Envia um push de teste para **todas as inscrições do usuário logado**. Sem corpo.
**Sucesso `200`:** `{ ok, sent:<n> }` (inscrições 404/410 são removidas automaticamente).
**Erros:** `401`, `503 VAPID não configurado` / `Supabase necessário`, `404 nenhuma inscrição ativa`.

### `GET /api/cron/notifications` — cron de notificações ⚠️ CRON_SECRET
Chamado pelo **Vercel Cron** (11:00 UTC). **Auth:** `Authorization: Bearer <CRON_SECRET>`.

Executa: lembretes de reunião (tabela `meetings`, próximas 24h), **updates recorrentes** que "caem" hoje (envia por WhatsApp, loga em `recurring_update_logs`/`report_sends`), e **tarefas atrasadas do CRM** (DM por responsável via `profiles.whatsapp`). Os alertas de churn/banco de horas/tarefas (dados mock) só rodam se `NOTIFY_MOCK_ALERTS=true`.

**Sucesso `200`:** `{ ok, meetingReminders, updatesSent, updatesFailed, crmOverdue, churn, hourBank, tasks }` (contadores). **Erro:** `401`.

---

## Solicitações do portal

### `POST /api/requests` — pedir reunião/conteúdo
Solicitações do portal do cliente. **Não exige sessão** (usa a sessão se houver, para identificar o cliente). Dispara notificação para a equipe.

- **Corpo:** `{ "type": "meeting"|"content", "payload": { subject, detail, area, urgency, slot } }`.
- Para `meeting` com Google configurado, cria um evento **"[A confirmar]"** (amanhã, placeholder — a equipe reagenda) com link do Meet.
- **Sucesso `200`:** `{ ok, id, persisted:false, event }`. **Erro:** `400 tipo inválido` / `JSON inválido`.

> Ainda **não persiste** em `meeting_requests`/`content_requests` (`persisted:false`); hoje serve para notificar a equipe e criar o rascunho de evento.

---

## Relatórios e PDF

### `/api/reports/send` — relatório por WhatsApp
**`GET`** — histórico de envios (`report_sends`): `{ sends:[...] }`. Sessão gerencial.

**`POST`** — envio **manual** do relatório: gera PDF com as métricas do período, sobe no Storage (`wa-media`) e envia como documento por WhatsApp; se falhar, cai em aviso de texto. Registra em `report_sends`.
- **Corpo:** `{ "clientId", "period": "julho de 2026", "metrics": [{ label, value, variation? }] }` (sem `metrics`, usa o resumo padrão de 4 métricas).
- **Sucesso `200`:** `{ ok, persisted:true, sent, mode:"pdf"|"text", url? }`.
- **Erros:** `400 clientId ausente`, `404 cliente não encontrado`, `400 cliente sem WhatsApp cadastrado`.

### `GET /api/le/pdf` — Linha Editorial em PDF ⚠️ PDF binário
Exporta a Linha Editorial do cliente. Sessão gerencial. **Query:** `clientId`.
**Resposta:** PDF (`Content-Type: application/pdf`, `inline`) — **não** é JSON. **Erro:** `401` (texto puro).

---

## Público

### `/api/public/lead` — captura de lead ⚠️ público + CORS
**Único endpoint sem sessão** — usado pelos formulários externos (`/captura/<slug>`). Usa **service-role** e valida pelo **slug** do formulário.

- **`OPTIONS`** — preflight CORS (`204`).
- **`POST`** — cria empresa + contato + negócio no CRM (1º estágio aberto do pipeline padrão).
- **CORS:** por padrão `*`; trave com `CAPTURE_ALLOWED_ORIGIN` (lista separada por vírgula).
- **Aceita** `application/json` **ou** `form-urlencoded`/`multipart` (formulário HTML puro). Campos `prop_<chave>` viram propriedades customizadas.
- **Honeypot:** o campo `website` deve vir **vazio**; preenchido → finge sucesso e ignora (anti-bot).

**Corpo (JSON):**
```json
{
  "slug": "landing-pro",
  "name": "João Silva",
  "company": "Acme",
  "email": "joao@acme.com",
  "phone": "27999998888",
  "segment": "Varejo",
  "message": "Quero uma proposta",
  "faturamento_medio_mensal": "50k-100k",
  "website": ""
}
```

| Situação | HTTP | Corpo |
|----------|------|-------|
| Criado | `200` | `{ ok:true, persisted:true }` |
| Modo demo (sem backend) | `200` | `{ ok:true, persisted:false }` |
| Honeypot acionado | `200` | `{ ok:true }` (ignorado) |
| Campos obrigatórios ausentes | `400` | `{ error:"dados obrigatórios ausentes" }` |
| Corpo inválido | `400` | `{ error:"corpo inválido" }` |
| Formulário inexistente/inativo | `404` | `{ error:"formulário indisponível" }` |
| Falha ao gravar | `500` | `{ error:"falha ao criar" }` |

Todas as respostas incluem os headers CORS. A gestão dos formulários (criar slug) é a rota [`/api/crm/capture-forms`](API-CRM.md#214-apicrmcapture-forms--formulários-de-captura).
