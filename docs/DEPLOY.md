# Deploy & Configuração

Como colocar o Painel Viofilme em produção. O guia detalhado de integrações (Supabase + Meta + IA) está em [BACKEND.md](BACKEND.md); aqui fica a visão de deploy e o mapa completo de variáveis.

---

## 1. Deploy (Vercel)

O projeto é um app **Next.js 16** e roda no **Vercel** (definição de cron em [vercel.json](../vercel.json)).

```bash
npm install
npm run build     # build de produção
npm run start     # servir o build (local)
```

Na Vercel: importe o repositório, configure as variáveis de ambiente (abaixo) para **Production** e **Preview**, e faça o deploy. O `vercel.json` já registra os cron jobs.

> Sem variáveis do Supabase, o deploy funciona em **modo demo**. Para dados reais, preencha ao menos o bloco Supabase.

---

## 2. Cron jobs

Registrados em [vercel.json](../vercel.json), autenticados com `Authorization: Bearer <CRON_SECRET>`:

| Rota | Agenda (UTC) | Função |
|------|--------------|--------|
| `/api/meta/sync` | `0 6 * * *` (06:00) | Sincroniza métricas da Meta de todos os clientes |
| `/api/cron/notifications` | `0 11 * * *` (11:00) | Lembretes de reunião, updates recorrentes, tarefas atrasadas, alertas |

---

## 3. Variáveis de ambiente

Modelo completo comentado em [.env.example](../.env.example). Resumo por serviço:

### Supabase (auth + banco + storage) — necessário para produção
| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima/publishable (cliente) |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave de serviço — **só servidor**, nunca exponha |

### Meta Graph API (Instagram + Facebook)
| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_META_APP_ID` | App ID (Business) |
| `META_APP_SECRET` | App secret |
| `META_GRAPH_VERSION` | Versão (ex.: `v21.0`) |
| `NEXT_PUBLIC_APP_URL` | URL pública (redirect OAuth) |

### OpenAI (IA Bruna + insights)
| Variável | Descrição |
|----------|-----------|
| `OPENAI_API_KEY` | Chave da OpenAI (só servidor) |
| `OPENAI_MODEL` | Opcional (padrão `gpt-4o-mini`) |

### Google Calendar
| Variável | Descrição |
|----------|-----------|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth client (Web) |
| `GOOGLE_CALENDAR_ID` | Calendário padrão (`primary`) |

### Asaas (financeiro)
| Variável | Descrição |
|----------|-----------|
| `ASAAS_WEBHOOK_TOKEN` | Valida o webhook de entrada |
| `ASAAS_API_KEY` | Chamadas de saída (previsto, ainda não usado) |
| `ASAAS_ENV` | `sandbox` ou `production` |

### WhatsApp (Uazapi)
| Variável | Descrição |
|----------|-----------|
| `UAZAPI_URL` | Base do servidor Uazapi |
| `UAZAPI_TOKEN` | Token da instância |
| `UAZAPI_WEBHOOK_SECRET` | (Opcional) valida o webhook de entrada |
| `UAZAPI_NOTIFY_NUMBERS` | Números internos para alertas (DDI+DDD, separados por vírgula) |

### Push / Cron
| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Par VAPID (Web Push) — gere com `npx web-push generate-vapid-keys` |
| `CRON_SECRET` | Protege as rotas de cron (`openssl rand -hex 32`) |
| `NOTIFY_MOCK_ALERTS` | Liga alertas do cron sobre dados de demonstração (deixe `false`) |

---

## 4. Checklist de produção

1. Criar projeto Supabase (região `sa-east-1`) e aplicar as migrations `0001`…`0026` na ordem.
2. Preencher o bloco **Supabase** → o painel sai do modo demo.
3. Criar usuários em Authentication → Users; ajustar `role`/`client_id`/`allowed_sections` em `profiles`.
4. Configurar **Meta** (App Business + App Review das permissões) e conectar cada cliente em Integrações.
5. (Opcional) Configurar **OpenAI**, **Google**, **Asaas**, **Uazapi** e **Push** conforme os módulos que for usar.
6. Definir `CRON_SECRET` e conferir os cron jobs na Vercel.
7. Registrar as URLs de callback OAuth: `{NEXT_PUBLIC_APP_URL}/api/meta/callback` e `/api/google/callback`; e os webhooks Asaas e Uazapi.

Passo a passo detalhado de Supabase, Meta e IA em [BACKEND.md](BACKEND.md).
