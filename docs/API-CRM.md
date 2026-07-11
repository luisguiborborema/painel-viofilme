# Referência da API do CRM (`/api/crm/*`)

Contrato completo das rotas internas do CRM: como fazer a requisição, o corpo esperado e as respostas de sucesso e erro. Todas são **internas** (consumidas pelo próprio painel), exigem sessão **gerencial** e recebem/retornam **JSON**.

> As rotas do CRM não são uma API pública versionada — são handlers Next.js chamados pela UI via `fetch`. Não há chave de API: a autorização vem do **cookie de sessão** do usuário logado.

---

## 1. Convenções comuns

Todas as rotas seguem o mesmo padrão.

### Requisição
- **Método:** `POST`
- **Header:** `Content-Type: application/json`
- **Credenciais:** cookie de sessão (enviado automaticamente pelo navegador; em `fetch` use `credentials: "include"` se aplicável).
- **Corpo:** objeto JSON. A maioria das rotas usa um campo **`action`** que seleciona a operação (`create`, `update`, `delete`, `move`, …). Quando `action` é omitido, o padrão costuma ser `create` (ou `update` se um `id` foi enviado).

```js
await fetch("/api/crm/leads", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ action: "create", name: "Acme", contactName: "João" }),
}).then((r) => r.json());
```

### Respostas — formato geral

| Situação | HTTP | Corpo |
|----------|------|-------|
| Sucesso (persistido) | `200` | `{ "ok": true, "persisted": true, ... }` |
| Sucesso em **modo demo** (sem Supabase) | `200` | `{ "ok": true, "persisted": false, ... }` — no-op, nada é gravado |
| Não autenticado / não gerencial | `401` | `{ "error": "não autorizado" }` |
| Sem permissão (Gestor exigido) | `403` | `{ "error": "não autorizado" }` |
| JSON malformado | `400` | `{ "error": "JSON inválido" }` |
| Validação de campos | `400` | `{ "error": "<campo> ausente" }` (ou mensagem específica) |
| Requisitos de estágio não cumpridos | `422` | `{ "error": "requisitos não cumpridos", "missing": ["Label…"] }` |
| Registro não encontrado | `404` | `{ "error": "<...> não encontrado" }` |
| Dependência externa indisponível | `502` / `503` | `{ "error": "…" }` |
| Erro no banco | `500` | `{ "error": "<mensagem do Postgres>" }` |

> **`persisted: false`** é a chave para entender o **modo demo**: a requisição "dá certo" (200) mas **não grava nada** — útil para a UI funcionar sem backend. Sempre confira `persisted` antes de assumir que o dado foi salvo.

### Como saber se deu certo
```js
const res = await fetch("/api/crm/...", { ... });
const data = await res.json();
if (!res.ok) throw new Error(data.error);      // 4xx/5xx → data.error
if (!data.persisted) { /* modo demo: não foi salvo */ }
```

---

## 2. Rotas

### 2.1 `/api/crm/leads` — negócios (deals)
CRUD e movimentação de leads. `action` padrão: `update` se houver `id`, senão `create`.

| `action` | Campos obrigatórios | O que faz |
|----------|--------------------|-----------|
| `create` | `name` + um contato (`contactId` **ou** `newContact.name` **ou** `contactName`) | Cria empresa (existente/nova/derivada do nome), contato primário, o deal e a associação deal↔contato. Resolve o `owner` por rodízio se vier vazio/`__auto__`. |
| `update` | `id` | Atualiza campos do deal |
| `move` | `id`, `stage` | Move de estágio; valida `requirements` do estágio destino; grava histórico; roda automações (task/whatsapp/notify/flow) |
| `change-pipeline` | `id`, `pipelineId` | Move o deal para o 1º estágio aberto de outro pipeline |
| `delete` | `id` | Exclui o deal (cascata por FK) |

**Corpo (create):**
```json
{
  "action": "create",
  "name": "Acme — Social Pro",
  "contactName": "João Silva",
  "contactPhone": "27999998888",
  "contactEmail": "joao@acme.com",
  "segment": "Varejo",
  "monthlyValue": 3500,
  "mediaBudget": 2000,
  "plan": "Social Pro + Tráfego",
  "probability": 40,
  "source": "Indicação",
  "owner": "__auto__",
  "companyId": "uuid-opcional",
  "newContact": { "name": "João", "phone": "279...", "title": "Diretor" },
  "pipelineId": "uuid-opcional",
  "stageId": "uuid-opcional"
}
```

**Sucessos:**
- create → `{ ok, persisted:true, id, companyId, contactId }`
- update / move / change-pipeline / delete → `{ ok, persisted:true }`

**Erros específicos:**
- `400` `nome ausente` · `400 "Selecione ou crie um contato para o negócio."` (create sem contato)
- `400` `id ausente` · `400 id/stage ausente` · `400 id/pipelineId ausente`
- `422` `{ error:"requisitos não cumpridos", missing:[...] }` (move bloqueado por regra do estágio)

---

### 2.2 `/api/crm/object` — editar campos, propriedades e tags
Atualiza colunas nativas, propriedades customizadas (jsonb, com **merge no servidor**) e tags de um objeto do CRM. Não usa `action`.

**Corpo:**
```json
{
  "objectType": "company",          // company | contact | deal | task
  "id": "uuid",
  "fields":     { "name": "Novo nome", "owner": "Maria" },
  "properties": { "instagram": "@acme" },   // mescladas às existentes
  "tags":       ["tagId1", "tagId2"]        // substitui a lista
}
```
Colunas nativas permitidas por tipo (whitelist): company `name,segment,website,phone,email,city,size,owner` · contact `name,title,phone,email,owner,company_id,is_primary` · deal `name,monthly_value,media_budget,plan,source,owner,probability,segment` · task `title,due_date,status,assignee`. Campos fora da whitelist são ignorados; `""` vira `null`.

**Sucesso:** `{ ok, persisted:true }` · **Erros:** `400 objectType/id inválido`.

---

### 2.3 `/api/crm/companies` — empresas
`action` padrão: `create`.

| `action` | Obrigatório | Retorno |
|----------|-------------|---------|
| `create` | `name` | `{ ok, persisted:true, id }` |
| `delete` | `id` | `{ ok, persisted:true }` |

Corpo (create): `name`, `segment`, `website`, `phone`, `email`, `city`, `size`, `owner`. Edição de campos → use [`/api/crm/object`](#22-apicrmobject--editar-campos-propriedades-e-tags). Em modo demo devolve `id` temporário (`co-tmp-…`). Erro: `400 nome ausente`.

### 2.4 `/api/crm/contacts` — contatos
Igual a companies. `create` exige `name`; aceita `companyId`, `title`, `phone`, `email`, `isPrimary`, `owner`. `delete` exige `id`. Modo demo → `id` `ct-tmp-…`.

---

### 2.5 `/api/crm/deal-contacts` — vincular contatos ao deal
Sempre exige `dealId` **e** `contactId`. `action` padrão: `add`.

| `action` | O que faz |
|----------|-----------|
| `add` | Associa o contato ao deal (upsert; aceita `role`) |
| `remove` | Remove a associação |
| `setPrimary` | Define o contato como primário do deal |

**Sucesso:** `{ ok, persisted:true }` · **Erro:** `400 dealId/contactId ausente`.

---

### 2.6 `/api/crm/tasks` — tarefas (próxima ação)
`action` padrão: `add`.

| `action` | Obrigatório | O que faz |
|----------|-------------|-----------|
| `add` | `leadId`, `title` | Cria a tarefa e fixa como "próxima ação" do lead. Aceita `dueDate` (ISO). Retorna `id` |
| `done` | `taskId` | Marca como concluída (`done_at`) |
| `reopen` | `taskId` | Reabre (volta a `pending`) |

**Erros:** `400 leadId/title ausente`, `400 taskId ausente`.

---

### 2.7 `/api/crm/interactions` — timeline + WhatsApp
Registra uma interação na timeline do lead; opcionalmente **envia** WhatsApp de verdade. Não usa `action`.

**Corpo:**
```json
{
  "leadId": "uuid",
  "channel": "whatsapp",      // whatsapp | email | call | note (padrão: note)
  "body": "Texto da nota ou mensagem",
  "bant": { "budget": "ok", "authority": "..." },   // opcional
  "send": true,               // se whatsapp + true + toPhone → envia via Uazapi
  "toPhone": "27999998888"
}
```
**Sucesso:** `{ ok, persisted:true, sent:boolean }` (`sent` indica se o WhatsApp foi disparado). **Erro:** `400 leadId/body ausente`. Se `bant` vier preenchido, também mescla no lead.

---

### 2.8 `/api/crm/pipelines` — funis
Usa `action` explícito (sem default útil).

| `action` | Obrigatório | O que faz |
|----------|-------------|-----------|
| `create` | `name` | Cria o funil + **estágios seed** (Novo → Perdido). Retorna `id` |
| `rename` | `id`, `name` | Renomeia |
| `set-default` | `id` | Define como padrão (desmarca os outros) |
| `delete` | `id` | Exclui — **bloqueado** se for o padrão |

**Sucesso:** `{ ok }` (create também retorna `id`). **Erros:** `400 nome ausente`, `400 id ausente`, `400 "Não é possível excluir o pipeline padrão."`

### 2.9 `/api/crm/stages` — estágios
`action` padrão: `update` se houver `id`, senão `create`.

| `action` | Obrigatório | Observações |
|----------|-------------|-------------|
| `create` | `label` | Gera `key` única por slug; usa pipeline informado ou o default. Retorna `id`, `key` |
| `update` | `id` | Atualiza `label`, `color`, `probability`, `kind` (open/won/lost), `requirements`, `automations` |
| `delete` | `id` | Reatribui os deals ao 1º estágio restante; **bloqueado** se for o último. Retorna `reassignedTo` |
| `reorder` | `orders: [{id, position}]` | Reordena em lote |

**Erros:** `400 rótulo ausente`, `400 orders ausente`, `404 estágio não encontrado`, `400 "Não é possível excluir o último estágio do pipeline."`

---

### 2.10 `/api/crm/properties` — definições de campos customizados
CRUD do **schema** (não dos valores — valores vão pelo `/object`). `action` padrão: `update` se houver `id`.

| `action` | Obrigatório | Observações |
|----------|-------------|-------------|
| `create` | `objectType`, `label` | `fieldType` ∈ {text, number, currency, select, multiselect, date, checkbox, phone, email, url}; gera `key`. Retorna `id`, `key` |
| `update` | `id` | Atualiza `label`, `field_type`, `options`, `position` |
| `delete` | `id` | Remove a definição |

**Erros:** `400 objectType inválido`, `400 rótulo ausente`, `400 tipo de campo inválido`.

### 2.11 `/api/crm/tags` — tags
`action` padrão: `update` se houver `id`, senão `create`. `create` exige `name` (cor padrão `#2a63c9`); `update`/`delete` exigem `id`. Aplicar tags a objetos → `/object`.

---

### 2.12 `/api/crm/task-flows` — fluxos de tarefas (playbooks)
Usa `action` explícito (`default` → `400 ação inválida`).

| `action` | Obrigatório | O que faz |
|----------|-------------|-----------|
| `create-flow` | `name` | Cria o fluxo (retorna `id`) |
| `rename-flow` | `id` | Renomeia |
| `delete-flow` | `id` | Exclui |
| `add-step` | `flowId`, `title` | Adiciona passo (aceita `dueDays`) |
| `update-step` | `stepId` | Edita `title`/`dueDays`/`position` |
| `delete-step` | `stepId` | Remove passo |
| `apply` | `dealId`, `flowId` | Cria as tarefas do fluxo no deal. Retorna `created` (nº de tarefas) |

**Erros:** `400 nome ausente`, `400 flowId/título ausente`, `400 fluxo sem passos`, `400 ação inválida`.

---

### 2.13 `/api/crm/goals` — metas de vendedor ⚠️ Gestor
**Única rota que exige acesso total (Gestor)** — senão `403`. Não usa `action`.

**Corpo:** `{ "owner": "Maria", "month": "2026-07", "target": 20000 }` (upsert por `owner`+`month`).
**Sucesso:** `{ ok, persisted:true }` · **Erro:** `400 owner/month ausente`.

---

### 2.14 `/api/crm/capture-forms` — formulários de captura
CRUD dos formulários públicos (`/captura/<slug>`). `action` padrão: `update` se houver `id`.

| `action` | Obrigatório | Observações |
|----------|-------------|-------------|
| `create` | `name` | Gera `slug` único; `source` padrão "Formulário". Retorna `id`, `slug` |
| `update` | `id` | `name`, `owner`, `source`, `active` |
| `delete` | `id` | Remove |

O envio público que **cria o lead** é a rota [`/api/public/lead`](APIS.md) (não requer sessão).

---

### 2.15 `/api/crm/merge` — mesclar duplicados
Não usa `action`; usa `type`.

**Corpo:** `{ "type": "company", "primaryId": "uuid", "mergeIds": ["uuid", ...] }` (`type` = company | contact).
Redireciona contatos/deals/associações ao registro primário e apaga os secundários.
**Sucesso:** `{ ok, merged: <n> }` · **Erro:** `400 parâmetros inválidos`.

---

### 2.16 `/api/crm/import` — importação em lote (CSV)
Recebe linhas **já parseadas no cliente**. Não usa `action`.

**Corpo:** `{ "rows": [{ empresa, contato, telefone, email, titulo, valor_mensal, plano, origem, responsavel, estagio }, ...] }`.
Para cada linha: find-or-create empresa (por nome) + contato + deal no 1º estágio aberto (ou o mapeado por `estagio`).
**Sucesso:** `{ ok, persisted:true, created: <n>, errors: ["Linha 2: ...", ...] }` — erros por linha **não** abortam o lote. **Erro:** `400 nenhuma linha válida`.

---

### 2.17 `/api/crm/schedule` — agendar reunião (Google) ⚠️ dependências
Cria evento no **Google Calendar** (com Meet), move o lead para "reunião", cria tarefa e interação.

**Corpo:** `{ "leadId", "startIso": "2026-07-10T14:00:00Z", "summary", "durationMin": 30, "description", "attendees": ["a@b.com"] }`.
**Sucesso:** `{ ok, event }` (objeto do evento com `id`, `hangoutLink`, `htmlLink`).
**Erros:** `400 leadId/startIso ausente`, `400 data inválida`, **`503 Google não configurado`**, **`502`** se a criação do evento falhar (reconectar o Google em Integrações).

---

### 2.18 `/api/crm/win` — Lead Ganho (automação)
Marca o lead como ganho e dispara o onboarding: cria o **cliente real** e registra as automações na timeline.

**Corpo:** `{ "leadId", "startDate": "01/07/2025", "monthlyValue", "mediaBudget", "plan", "owner", "source" }`.
**Sucesso:** `{ ok, persisted:true, clientId, automations:[{module,label,done}] }`. Em modo demo: `{ ok, persisted:false, automations }`.
**Erros:** `400 leadId ausente`, `404 lead não encontrado`.

> As automações M4 (fatura Asaas), M5 (ficha CS), Portal e Contrato hoje vêm marcadas como `done:false` (simuladas); só a criação do cliente (M3) é real.

---

### 2.19 `/api/crm/proposal` — proposta em PDF ⚠️ resposta binária
Gera a proposta do negócio. **Não usa modo demo** (exige Supabase → `503` sem backend).

| `action` | Retorno |
|----------|---------|
| `download` (padrão) | **PDF binário** (`Content-Type: application/pdf`, `Content-Disposition: attachment`) — **não** é JSON |
| `send` | Sobe o PDF no Storage (`wa-media`) e envia ao contato por WhatsApp → `{ ok, sent:boolean }` |

**Corpo:** `{ "action": "send", "dealId": "uuid", "scope": "linha1\nlinha2", "validityDays": 15 }`.
**Erros:** `400 dealId ausente`, `404 negócio não encontrado`, `503 backend indisponível`, `503 WhatsApp/serviço indisponível`, `400 contato sem WhatsApp`, `500 falha ao subir PDF`.

---

### 2.20 `/api/crm/comments` — comentários internos do negócio
Comentários da equipe num negócio (separados da timeline). Suportam thread, edição, exclusão e reações. `action` padrão: `edit` se houver `id`, senão `create`.

| `action` | Obrigatório | O que faz |
|----------|-------------|-----------|
| `create` | `leadId`, `body` | Cria comentário (ou resposta, se `parentId`). Retorna `id`, `createdAt` |
| `edit` | `id`, `body` | Edita o corpo (marca `edited`). **Só o autor** ou um Gestor |
| `delete` | `id` | Exclui (respostas caem em cascata). **Só o autor** ou um Gestor |
| `react` | `id`, `emoji` | Alterna a reação do usuário. Retorna `reactions` atualizado |

**Corpo (create):** `{ "action":"create", "leadId":"uuid", "body":"texto", "parentId":"uuid?" }`.
**Sucesso:** `{ ok, persisted:true, ... }` · **Erros:** `400 leadId/body ausente`, `403 sem permissão` (editar/excluir de outro autor), `404 comentário não encontrado`, `400 ação inválida`. Reações e nomes de autor são guardados na tabela `crm_comments` (migration `0027`).

---

## 3. Resumo dos códigos de status

| HTTP | Significado no CRM |
|------|--------------------|
| `200` | OK — verifique `persisted` (false = modo demo, nada salvo) |
| `400` | Corpo/JSON inválido ou campo obrigatório ausente |
| `401` | Sem sessão ou não é gerencial |
| `403` | Precisa ser Gestor (só `/goals`) |
| `404` | Registro não encontrado (lead/estágio/negócio) |
| `422` | Requisitos do estágio não cumpridos (`move` em `/leads`) |
| `502` | Falha ao criar evento no Google (`/schedule`) |
| `503` | Dependência externa indisponível (Google, WhatsApp, Storage) |
| `500` | Erro do banco (mensagem do Postgres em `error`) |

Para as demais rotas internas (não-CRM) e serviços externos, ver [APIS.md](APIS.md).
