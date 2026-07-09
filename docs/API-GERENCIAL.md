# Referência da API Gerencial (`/api/gerencial/*`)

Rotas internas de gestão da agência: time, configuração de cliente, metas, updates recorrentes e playbooks. Exigem sessão **gerencial** e seguem as [convenções comuns](API-CRM.md#1-convenções-comuns). Algumas exigem **Gestor** (acesso total) e/ou **service-role**.

---

## `POST /api/gerencial/team` — usuários da equipe ⚠️ Gestor + service-role
Cria e gerencia usuários gerenciais. **Exige Gestor** (`403` caso contrário) e **service-role** (`503 Supabase/service-role necessário`). Usa `action`.

| `action` | Obrigatório | O que faz |
|----------|-------------|-----------|
| `create` | `email`, `name` | Cria o usuário. `mode:"invite"` envia convite por e-mail; senão exige `password` (≥ 6). Grava `profiles` (team_role, allowed_sections). Retorna `{ ok, id, invited }` |
| `update` | `userId` | Atualiza `teamRole`, `allowedSections`, `whatsapp` |
| `reset_password` | `userId`, `password` (≥ 6) | Redefine a senha |
| `set_active` | `userId`, `active` | Ativa/desativa (ban). **Não** permite desativar a si mesmo |
| `send_reset_email` | `email` | Dispara e-mail de redefinição (redirect `/definir-senha`) |

**Corpo (create):**
```json
{
  "action": "create",
  "mode": "invite",
  "email": "novo@viofilme.com.br",
  "name": "Fulano",
  "teamRole": "trafego",
  "allowedSections": ["clientes","campanhas","resultados","relatorios"],
  "password": "senha123"
}
```
> `teamRole: "gestor"` força `allowed_sections = null` (acesso total). Ver os templates em [AUTENTICACAO.md](AUTENTICACAO.md#templates-de-time-team_templates).

**Erros:** `403` (não é Gestor), `400 informe nome e e-mail`, `400 senha mínima de 6 caracteres`, `400 userId ausente`, `400 "você não pode desativar a si mesmo"`, `400 ação inválida`, `503`.

---

## `POST /api/gerencial/client-config` — configuração do cliente
Persiste flags do cliente em `clients`.

**Corpo:**
```json
{
  "clientId": "uuid",
  "hasPaidTraffic": true,
  "clientType": "lead_gen",              // lead_gen | ecommerce | local_business
  "activeNetworks": ["instagram","facebook"],
  "asaasCustomerId": "cus_000...",
  "whatsapp": "5527999998888"
}
```
**Sucesso `200`:** `{ ok, persisted:true }` · **Erro:** `400 clientId ausente`.

---

## `/api/gerencial/client-goals` — metas de métrica por cliente

### `GET` — ler metas
**Query params:** `clientId`, `period` (`YYYY-MM`). **Sucesso:** `{ goals:[...] }`. **Erro:** `400 clientId/period ausente`.

### `POST` — salvar (upsert) metas
**Corpo:** `{ "clientId", "period":"2026-07", "goals":[{ "metric":"conversions", "targetValue":120 }, ...] }`.
Metas com `targetValue > 0` são gravadas; **`0`/vazio remove** a meta daquela competência.
**Sucesso `200`:** `{ ok, persisted:true }` · **Erro:** `400 payload inválido`.

---

## `/api/gerencial/recurring-updates` — updates recorrentes

### `GET` — listar
**Query params:** `clientId` (opcional). **Sucesso:** `{ updates:[...] }`.

### `POST` — criar/editar/pausar/remover
`action` padrão: `update` se houver `id`, senão `create`.

| `action` | Obrigatório | O que faz |
|----------|-------------|-----------|
| `create` | `clientId`, `metrics[]`, `recurrence` | Cria (canal `whatsapp`, destino `client`). Retorna `id` |
| `update` | `id`, `metrics[]`, `recurrence` | Atualiza métricas/recorrência |
| `toggle` | `id`, `status` (`active`|`paused`) | Pausa/reativa |
| `delete` | `id` | Remove |

**Corpo (create):** `{ "action":"create", "clientId":"uuid", "metrics":["followers_growth","reach"], "recurrence":"weekly:1" }`.
**Erros:** `400 clientId ausente`, `400 id ausente`, `400 id/status ausente`, `400 métricas/recorrência ausentes`.
> Os disparos são feitos pelo cron `/api/cron/notifications`.

---

## `POST /api/gerencial/playbooks` — setores e documentos
CRUD de setores/playbooks. Usa `action` (default → `400 ação inválida`).

| `action` | Obrigatório | O que faz |
|----------|-------------|-----------|
| `create-sector` | `name` | Cria setor (retorna `id`) |
| `rename-sector` | `id` | Renomeia |
| `delete-sector` | `id` | Exclui |
| `create-playbook` | `sectorId`, `title` | Cria doc (`content`, `format` md/html). Retorna `id` |
| `update-playbook` | `id` | Edita `title`/`content`/`format`/`sectorId` |
| `delete-playbook` | `id` | Exclui |
| `add-attachment` | `id`, `attachment` | Anexa `{id,name,url,contentType,size}` ao doc |
| `remove-attachment` | `id`, `attachmentId` | Remove o anexo (e apaga do Storage) |

**Erros:** `400 nome ausente`, `400 setor/título ausente`, `400 dados ausentes`, `400 ação inválida`.

## `POST /api/gerencial/playbooks/upload` — anexo ⚠️ multipart
**Não é JSON** — `multipart/form-data`. Sobe no bucket `playbook-files`.

**Form fields:** `file` (obrigatório, ≤ 25 MB), `playbookId` (opcional).
**Sucesso `200`:** `{ ok, attachment:{ id, name, url, contentType, size } }` — passe esse `attachment` no `add-attachment`.
**Erros:** `400 arquivo ausente`, `413 arquivo acima de 25MB`, `503 storage indisponível`, `500`.
