# Referência da API do Inbox (`/api/inbox/*`)

Rotas internas do atendimento WhatsApp ao vivo. Todas exigem sessão **gerencial** e seguem as [convenções comuns](API-CRM.md#1-convenções-comuns) (auth por cookie, `persisted:false` em modo demo, `error` em falhas). O envio/recebimento real de WhatsApp usa o **Uazapi** (ver [API-INTEGRACOES.md](API-INTEGRACOES.md)).

---

## `GET /api/inbox/conversations` — lista de conversas
Usado no polling da lista. **Query params** (opcionais): `assignedTo`, `status` (`open`|`pending`|`closed`).

**Sucesso `200`:** `{ "conversations": [ ... ] }` · **Erro:** `401`.

---

## `GET /api/inbox/messages` — mensagens de uma conversa
Polling do chat aberto. **Query params:** `conversationId` (obrigatório), `read=1` (opcional — zera o contador de não-lidas).

| Situação | HTTP | Corpo |
|----------|------|-------|
| OK | `200` | objeto da conversa com mensagens |
| Sem `conversationId` | `400` | `{ error:"conversationId ausente" }` |
| Não encontrada | `404` | `{ error:"não encontrada" }` |

---

## `POST /api/inbox/send` — enviar texto
Envia texto pela conversa (via Uazapi) e grava em `wa_messages`; se a conversa está vinculada a um lead, espelha na timeline do CRM.

**Corpo:** `{ "conversationId": "uuid", "text": "Olá!" }`
**Sucesso `200`:** `{ ok, persisted:true, sent:boolean }` (`sent` = WhatsApp realmente disparado).
**Erros:** `400 conversationId/text ausente`, `404 conversa não encontrada`.

---

## `POST /api/inbox/send-media` — enviar mídia
Envia um arquivo (por **URL pública** — suba antes em `/api/inbox/upload`).

**Corpo:**
```json
{
  "conversationId": "uuid",
  "type": "image",          // image | audio | video | document (padrão: document)
  "fileUrl": "https://.../arquivo.jpg",
  "caption": "legenda opcional",
  "filename": "documento.pdf"
}
```
**Sucesso `200`:** `{ ok, persisted:true, sent }` · **Erros:** `400 conversationId/fileUrl ausente`, `404 conversa não encontrada`.

---

## `POST /api/inbox/assign` — atribuir/mudar status
Define atendente e/ou muda o status da conversa.

**Corpo:** `{ "conversationId": "uuid", "assignedTo": "userId | null", "status": "open|pending|closed" }` (ambos opcionais além do `conversationId`).
**Sucesso `200`:** `{ ok, persisted:true }` · **Erro:** `400 conversationId ausente`.

---

## `POST /api/inbox/upload` — upload de arquivo ⚠️ multipart
**Não é JSON** — envie `multipart/form-data`. Sobe no bucket `wa-media` (Supabase Storage) e devolve a URL pública para usar no `send-media`.

**Form fields:** `file` (obrigatório, ≤ 16 MB), `conversationId` (opcional).
**Sucesso `200`:** `{ ok, url:"https://...", contentType }`.
**Erros:** `400 arquivo ausente`, `413 arquivo acima de 16MB`, `503 storage indisponível` (sem Supabase/service-role), `500` (erro no upload).

---

## `GET /api/inbox/debug` — diagnóstico do webhook
Mostra as **últimas 20 chamadas** recebidas no webhook do WhatsApp (payload cru + nota). Abra logado como gerencial.

**Sucesso `200`:** `{ count, events:[{ raw, note, received_at }] }` · **Erros:** `401`, `503 supabase não configurado`.
