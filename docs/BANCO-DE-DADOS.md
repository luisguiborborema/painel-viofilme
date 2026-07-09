# Banco de Dados (Postgres / Supabase)

Schema completo do painel, definido nas migrations [supabase/migrations/](../supabase/migrations/) (`0001` a `0026`). Toda tabela tem **RLS habilitado**; a coluna de isolamento é `client_id` (por cliente) e, no CRM, `owner` (por vendedor).

> Aplicar na ordem numérica no SQL Editor do Supabase ou via `supabase db push`. As migrations são idempotentes (`if not exists` / `on conflict`).

---

## Enums

| Enum | Valores |
|------|---------|
| `user_role` | `gerencial`, `cliente` |
| `platform` | `instagram`, `facebook` |
| `post_status` | `published`, `scheduled`, `draft` |
| `media_type` | `image`, `video`, `carousel`, `reel`, `story` |
| `campaign_status` | `active`, `paused`, `ended`, `draft` |
| `client_type` | `lead_gen`, `ecommerce`, `local_business` |
| `request_status` | `pending`, `scheduled`, `in_progress`, `done`, `declined` |
| `urgency_level` | `normal`, `urgent` |

## Funções auxiliares (SECURITY DEFINER)

Evitam recursão de RLS ao ler o perfil do usuário logado:
- `app_role()` → papel do usuário · `app_client_id()` → cliente vinculado · `app_full_name()` → nome (matching de owner no CRM) · `app_is_manager()` → é gestor?

## Trigger
- `on_auth_user_created` → `handle_new_user()`: cria automaticamente a linha em `profiles` ao registrar um usuário (lê `full_name`/`role` do metadata; padrão `cliente`).

---

## Núcleo & Autenticação

### `clients` — empresas atendidas
`id`, `name`, `slug` (unique), `segment`, `instagram_username`, `facebook_page_name`, `status`, `monthly_fee`, `has_paid_traffic`, `client_type`, `active_networks` (`platform[]`), `asaas_customer_id`, `whatsapp`, `created_at`.
**RLS:** gerencial vê todos; cliente vê só o próprio.

### `profiles` — usuários (1:1 com `auth.users`)
`id` (FK auth.users), `full_name`, `role` (`user_role`), `client_id` (FK clients), `avatar_url`, `preferred_metrics` (`text[]`), `team_role`, `allowed_sections` (`text[]`, NULL = acesso total), `whatsapp`, `created_at`.
**RLS:** usuário vê o próprio; gerencial vê todos.

---

## Meta / Métricas sociais

| Tabela | Propósito | Colunas-chave |
|--------|-----------|---------------|
| `meta_connections` | Tokens OAuth Meta por cliente | `client_id` (unique), `ig_user_id`, `fb_page_id`, `access_token`, `token_expires_at`, `scopes[]`, `ad_account_id`, `last_synced_at` |
| `account_metrics` | Métricas diárias da conta | `client_id`, `platform`, `date`, `followers`, `reach`, `impressions`, `profile_views` — unique `(client_id, platform, date)` |
| `content_posts` | Posts publicados/agendados | `client_id`, `external_id`, `platform`, `media_type`, `status`, `caption`, `permalink`, `media_url`, `likes/comments/shares/saves/reach/impressions` |
| `campaigns` | Campanhas Meta Ads | `client_id`, `external_id`, `name`, `objective`, `status`, `budget`, `spend`, `start_date`, `end_date` |
| `campaign_metrics` | Métricas diárias de campanha | `campaign_id`, `date`, `impressions`, `reach`, `clicks`, `spend`, `conversions` — unique `(campaign_id, date)` |

Todas com RLS por cliente. Populadas (upsert idempotente) pela sincronização Meta — ver [BACKEND.md](BACKEND.md).

---

## Portal & Reuniões

| Tabela | Propósito |
|--------|-----------|
| `meetings` | Reuniões com o cliente (`title`, `starts_at`, `join_url`, `agenda`, `participants[]`, `next_steps`) |
| `meeting_requests` | Solicitações de reunião do cliente (`subject`, `preferred_at`, `alternate_at`, `urgency`, `status`) |
| `content_requests` | Solicitações de conteúdo do cliente (`format`, `networks[]`, `desired_date`, `guideline`, `reference_urls[]`, `urgency`, `status`) |

RLS: gerencial gerencia; cliente lê/cria os próprios.

---

## Financeiro (Asaas)

| Tabela | Propósito | Colunas-chave |
|--------|-----------|---------------|
| `payments` | Pagamentos/cobranças do Asaas | `asaas_payment_id` (unique), `client_id`, `status`, `billing_type`, `value`, `net_value`, `due_date`, `payment_date`, `invoice_url`, `raw` (jsonb) |
| `asaas_webhook_events` | Log/idempotência do webhook | `event_id` (PK), `event`, `payment_id`, `raw`, `received_at` |

Escrita via `service_role` (webhook). RLS de leitura: gerencial vê tudo; cliente vê os próprios pagamentos.

## Push

| Tabela | Propósito |
|--------|-----------|
| `push_subscriptions` | Inscrições Web Push por device (`user_id`, `endpoint` unique, `p256dh`, `auth`, `user_agent`). Usuário gerencia as próprias. |

---

## CRM

### Núcleo
- **`crm_leads`** — negócios/deals. Campos: `name`, `contact_*`, `stage_id` (FK `crm_stages`), `pipeline_id`, `company_id`, `primary_contact_id`, `monthly_value`, `media_budget`, `probability` (0–100), `source`, `owner`, `bant` (jsonb), `next_task_*`, `won_at/lost_at/lost_reason`, `tags[]`, `properties` (jsonb), `converted_client_id`. (`stage` texto é legado.)
- **`crm_companies`** — empresas reutilizáveis (`name`, `segment`, `website`, `phone`, `email`, `size`, `owner`, `tags[]`, `properties`).
- **`crm_contacts`** — pessoas (`company_id`, `name`, `title`, `phone`, `email`, `is_primary`, `owner`, `tags[]`, `properties`).
- **`crm_deal_contacts`** — N:N deal↔contato (`deal_id`, `contact_id`, `role`, `is_primary`).
- **`crm_interactions`** — timeline omni-channel (`lead_id`, `channel`, `direction`, `body`, `author`, `meta`, `external_id`).
- **`crm_tasks`** — próximas ações (`lead_id`, `title`, `due_date`, `status`, `assignee`, `properties`).

### Configuração do funil
- **`crm_pipelines`** — funis (`name`, `is_default`, `position`). Seed: "Pipeline comercial".
- **`crm_stages`** — estágios (`pipeline_id`, `key`, `label`, `color`, `probability`, `kind` open/won/lost, `requirements` jsonb, `automations` jsonb). Seed: 6 estágios (Prospecção → Ganho/Perdido).
- **`crm_properties`** — definição de campos customizados (`object_type` company/contact/deal/task, `key`, `label`, `field_type`, `options`).
- **`crm_tags`** — tags com cor. Seed: Quente, Indicação, Enterprise, Retomar.
- **`crm_lost_reasons`** — motivos de perda. Seed: preço, sem budget, concorrente, etc.
- **`crm_stage_history`** — log de mudanças de estágio (análise de funil).
- **`crm_task_flows`** / **`crm_task_flow_steps`** — fluxos (playbooks) de tarefas em cadência.
- **`crm_goals`** — meta de MRR novo por `owner` + `month` (unique).
- **`crm_capture_forms`** — formulários públicos `/captura/<slug>` que geram leads (`slug` unique, `owner`, `source`, `active`). Leitura pública via service_role.

**RLS de owner (migration 0024):** gestor vê tudo; vendedor vê deals/tarefas/interações com `owner = seu nome` **ou** `owner IS NULL` (pool compartilhado). Vale para `crm_leads`, `crm_tasks`, `crm_interactions`.

---

## Inbox / WhatsApp

| Tabela | Propósito | Colunas-chave |
|--------|-----------|---------------|
| `wa_conversations` | Uma conversa por número | `phone` (unique), `name`, `lead_id`, `assigned_to` (FK profiles), `status` (open/pending/closed), `last_message_*`, `unread_count` |
| `wa_messages` | Mensagens da conversa | `conversation_id`, `direction` (in/out), `type` (text/audio/image/document), `body`, `media_url`, `author`, `external_id` (unique, idempotência), `status` |
| `wa_webhook_log` | Diagnóstico do webhook Uazapi | `raw` (jsonb), `note`, `received_at` |

RLS: gerencial gerencia; `wa_webhook_log` é só leitura (debug).

---

## Google, Metas de cliente e Relatórios

| Tabela | Propósito |
|--------|-----------|
| `google_connections` | Tokens OAuth do Google Calendar (`scope`='agency', `access_token`, `refresh_token`, `token_expiry`, `calendar_id`, `read_calendar_ids`). Escrita via service_role. |
| `client_goals` | Metas de métrica por cliente/mês (`metric`, `target_value`, `period` YYYY-MM) — usadas na Gestão à Vista |
| `recurring_updates` | Config de updates automáticos (`metrics` jsonb, `recurrence`, `channel`, `recipient`, `status`, `last_sent_at`) |
| `recurring_update_logs` | Histórico de cada disparo (`update_id`, `payload`, `delivery_status`, `sent_at`) |
| `report_sends` | Histórico de envios (manuais + automáticos): `client_id`, `kind`, `channel`, `recipient`, `sent_by`, `detail` |

## Playbooks

| Tabela | Propósito |
|--------|-----------|
| `playbook_sectors` | Setores/áreas de documentação (`name`, `position`) |
| `playbooks` | Documentos MD/HTML (`sector_id`, `title`, `content`, `format`, `attachments` jsonb, `position`) |

---

## Grants & RLS (resumo)

- Migration `0004` concede grants completos a `anon`, `authenticated` e `service_role`; a **RLS governa a visibilidade linha-a-linha**.
- `service_role` (webhooks Asaas/Uazapi, callbacks OAuth, cron, uploads no Storage) **bypassa** a RLS.
- Idempotência de webhooks via índices únicos (`external_id`) e tabela de eventos (`asaas_webhook_events`).

## Storage

Buckets públicos criados/escritos via client admin:
- `wa-media` — mídia enviada/recebida no WhatsApp.
- `playbook-files` — anexos dos playbooks.
