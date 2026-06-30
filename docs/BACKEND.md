# Backend — Meta → Supabase + IA (Bruna)

Guia para sair do **modo demo** e rodar com dados reais. O painel detecta
automaticamente: se as variáveis do Supabase estão preenchidas, usa banco real;
senão, cai no modo demonstração (mock + login demo).

---

## 1. Supabase

### 1.1 Criar o projeto
1. Em app.supabase.com → **New project** (dedicado ao Viofilme, **separado** de
   qualquer outro produto). Região sugerida: `sa-east-1` (São Paulo).
2. Em **Project Settings → API**, copie:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` / `publishable` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key (secreta) → `SUPABASE_SERVICE_ROLE_KEY`

### 1.2 Aplicar as migrations
Na ordem, no **SQL Editor** do Supabase (ou via CLI `supabase db push`):
- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_portal_v2.sql`
- `supabase/migrations/0003_meta_sync.sql`

### 1.3 Seed mínimo
1. Crie 1 linha em `public.clients` (nome, segmento, `client_type`,
   `has_paid_traffic`, `active_networks`).
2. Crie os usuários em **Authentication → Users**:
   - 1 **gerencial** e 1 **cliente**.
   - No `user_metadata` do gerencial: `{"role":"gerencial","full_name":"..."}`.
   - O trigger `handle_new_user` cria o `profiles` automaticamente; depois
     ajuste `profiles.client_id` do usuário cliente para o `id` do cliente
     criado e confirme `profiles.role`.

> RLS já isola tudo por cliente: o cliente só lê o próprio `client_id`; o
> gerencial lê e gerencia tudo.

---

## 2. Meta (Instagram + Facebook)

1. Crie um app **Business** em developers.facebook.com/apps.
2. Adicione os produtos **Facebook Login** e **Instagram Graph API**.
3. Em Facebook Login → Settings, registre a redirect URI:
   `https://SEU_DOMINIO/api/meta/callback` (e a de localhost para testes).
4. **App Review** das permissões (necessário para dados de clientes reais):
   `pages_show_list`, `pages_read_engagement`, `instagram_basic`,
   `instagram_manage_insights`, `read_insights`, `ads_read`.
   - Em **modo dev** funciona só com contas/usuários de teste do app.
5. Preencha `NEXT_PUBLIC_META_APP_ID`, `META_APP_SECRET`, `NEXT_PUBLIC_APP_URL`.
6. No painel: **Gerencial → Integrações → Conectar** (por cliente). O callback
   grava a conexão em `meta_connections`.
7. (Opcional) Para puxar campanhas de tráfego pago, preencha
   `meta_connections.ad_account_id` (formato `act_<id>`) do cliente.

### Como o sync funciona
- **Manual**: botão **Sincronizar** no card do cliente (Integrações) →
  `POST /api/meta/sync?client=<id>` (somente gerencial).
- **Automático**: `vercel.json` agenda `GET /api/meta/sync` todo dia às 06:00 UTC.
  O Vercel envia `Authorization: Bearer <CRON_SECRET>`. Defina `CRON_SECRET`.
- O que grava: conta IG (seguidores/alcance/impressões → `account_metrics`),
  mídias → `content_posts`, campanhas + métricas diárias → `campaigns` /
  `campaign_metrics`. É **idempotente** (upsert por chave natural).

---

## 3. IA (Bruna + insights)

Defina `OPENAI_API_KEY` (e, opcionalmente, `OPENAI_MODEL` — padrão `gpt-4o-mini`).
Com ela, `/api/chat` (Bruna) e `/api/insights` respondem de verdade, usando o
contexto real do cliente (que vem das tabelas acima via `getClientAiContext`).
Sem ela, caem no fallback de demonstração.

---

## 4. Variáveis no Vercel

Settings → Environment Variables (Production + Preview):

| Variável | Origem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase API (secreta) |
| `NEXT_PUBLIC_META_APP_ID` | Meta app |
| `META_APP_SECRET` | Meta app (secreta) |
| `NEXT_PUBLIC_APP_URL` | domínio de produção |
| `META_GRAPH_VERSION` | ex.: `v21.0` |
| `OPENAI_API_KEY` | OpenAI (secreta) |
| `OPENAI_MODEL` | opcional, ex.: `gpt-4o-mini` ou `gpt-4o` |
| `CRON_SECRET` | `openssl rand -hex 32` (secreta) |

---

## 5. O que ainda NÃO vem da Meta

Estes módulos seguem em dados de demonstração até ganharem origem própria
(não há fonte na Meta para eles): **Financeiro** (faturas/contratos), **Hub de
marca** (logos/manual) e os painéis internos de **Customer Success / C-Level**.
Reuniões já leem da tabela `meetings` (a agência cadastra). Próximo passo
natural: tabela de faturas + tela gerencial para lançá-las.
```
