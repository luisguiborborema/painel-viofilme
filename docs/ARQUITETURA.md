# Arquitetura

Visão técnica geral do Painel Viofilme.

---

## 1. Princípios

1. **Dual-mode automático.** O mesmo código roda em **modo demo** (dados mock + login simulado) ou **modo produção** (Supabase). A detecção é feita por `isSupabaseConfigured()` — se as variáveis do Supabase são válidas, usa banco real; senão, mock. Nenhuma tela sabe de onde vem o dado.
2. **Server-first (Next.js App Router).** A maior parte das telas são **Server Components** que buscam dados no servidor via a camada `src/lib/data/`. Interatividade fica em Client Components pontuais.
3. **Segurança em camadas.** Proteção de rota no middleware (`src/proxy.ts`), RBAC por seção no layout gerencial, e **RLS no Postgres** como última linha (isola por cliente e por owner no CRM).
4. **Integrações isoladas.** Cada serviço externo (Meta, Google, OpenAI, Asaas, Uazapi, Push) vive em `src/lib/<serviço>/` e degrada graciosamente para _fallback_ quando sua chave não está presente.

---

## 2. Estrutura de pastas

```
src/
├─ app/                        # Rotas (App Router)
│  ├─ layout.tsx               # Layout raiz (tema, PWA, fontes)
│  ├─ login/                   # Tela de login (+ atalhos demo)
│  ├─ definir-senha/           # Definição/reset de senha
│  ├─ captura/[slug]/          # Formulário público de captura de leads
│  ├─ gerencial/               # ÁREA DA AGÊNCIA (protegida por papel + RBAC)
│  │  ├─ layout.tsx            # Guarda de acesso por seção
│  │  ├─ crm/                  # CRM & vendas (+ [id], contato/[id], empresa/[id])
│  │  ├─ inbox/ agenda/        # Atendimento WhatsApp + Google Agenda
│  │  ├─ clientes/             # Hub de clientes (+ [id])
│  │  ├─ entregas/ conteudo/   # Painel de entregas + VioFlux
│  │  ├─ gestao-a-vista/       # Painel analítico (tráfego/social/liderança)
│  │  ├─ relatorios/ documentos/ financeiro/ rh/ integracoes/
│  ├─ cliente/                 # PORTAL DO CLIENTE (protegido por papel)
│  │  ├─ conteudo/ campanhas/ resultados/ financeiro/ central/
│  ├─ configuracoes/           # Configurações da conta (ambos os papéis)
│  └─ api/                     # Route Handlers (ver docs/APIS.md)
├─ components/
│  ├─ shell/                   # Sidebar, topbar, app-shell
│  ├─ brand/ ui/ dashboard/    # Marca, primitivos de UI, KPIs/gráficos/tabelas
│  ├─ gerencial/ cliente/ crm/ inbox/  # Componentes por área
│  ├─ pwa/ theme/ settings/ auth/
├─ lib/
│  ├─ auth/                    # Sessão, papéis, login/logout, demo, RBAC
│  ├─ access.ts                # RBAC por seção (SectionKey, templates de time)
│  ├─ nav.ts                   # Menu (grupos/itens) filtrado por permissão
│  ├─ supabase/                # Clients browser/server/admin + middleware
│  ├─ data/                    # Camada de dados dual-mode (ver docs/CAMADA-DE-DADOS.md)
│  ├─ meta/ google/ asaas/ whatsapp/ push/  # Integrações externas
│  ├─ crm/ reports/            # Geradores de PDF (proposta, relatório, LE)
│  └─ ...                      # datetime, utils, metric-glossary, use-persistent-state
└─ proxy.ts                    # Middleware de proteção de rotas
supabase/migrations/           # Schema + RLS (0001 … 0026)
public/                        # sw.js, ícones, manifest, brand
docs/                          # Esta documentação
```

---

## 3. Papéis e navegação

Dois papéis (`Role`): **`gerencial`** e **`cliente`** ([src/lib/auth/types.ts](../src/lib/auth/types.ts)).

- **Cliente** → menu fixo com Visão geral, Conteúdo, Campanhas, Resultados, Financeiro, Marca & acessos, Configurações.
- **Gerencial** → menu em grupos (**Comercial**, **Operacional**, **Gestão**, **Conta**), filtrado pelas seções que o usuário pode acessar (RBAC — ver [AUTENTICACAO.md](AUTENTICACAO.md)).

O menu é montado por [src/lib/nav.ts](../src/lib/nav.ts) e as permissões por [src/lib/access.ts](../src/lib/access.ts).

---

## 4. Fluxo de uma requisição autenticada

```
Navegador
   │  request para /gerencial/... ou /cliente/...
   ▼
src/proxy.ts (middleware)
   │  updateSession() renova o token Supabase; sem sessão → redirect /login
   ▼
Layout da área (ex.: app/gerencial/layout.tsx)
   │  getSession() → SessionUser normalizado
   │  RBAC: canAccessPath() barra seção não permitida
   ▼
Server Component da página
   │  chama src/lib/data/queries.ts (getX)
   │        ├─ Supabase configurado → src/lib/data/supabase.ts (com RLS)
   │        └─ senão → src/lib/data/mock.ts
   ▼
HTML renderizado no servidor → hidratado no cliente
```

Mutações (criar lead, enviar WhatsApp, etc.) passam por **Route Handlers** em `src/app/api/*` ou **Server Actions**, sempre revalidando o papel/seção antes de escrever. Ver [APIS.md](APIS.md).

---

## 5. Modo demo vs produção

| Aspecto | Modo demo | Modo produção |
|---------|-----------|---------------|
| Gatilho | Sem `NEXT_PUBLIC_SUPABASE_URL` válido | Supabase configurado |
| Login | Cookie `vio_demo_session` (credenciais fixas) | Supabase Auth (JWT + cookies) |
| Dados | `src/lib/data/mock.ts` (determinísticos) | Postgres via RLS |
| IA / Meta / Asaas / WhatsApp / Push | Fallback estático | Chamadas reais se a chave existir |

A detecção central está em [src/lib/supabase/config.ts](../src/lib/supabase/config.ts) (`isSupabaseConfigured()`), que valida URL + tamanho da chave e rejeita placeholders (`your-project`).

---

## 6. Segurança

- **Headers** globais (`X-Content-Type-Options`, `Referrer-Policy`) em [next.config.ts](../next.config.ts).
- **Service role** (`SUPABASE_SERVICE_ROLE_KEY`) só no servidor — usado por webhooks, cron e uploads no Storage. Nunca exposto ao cliente.
- **Webhooks** (Asaas, Uazapi) validam segredo antes de gravar; eventos são idempotentes (índices únicos / tabela de eventos processados).
- **RLS** isola dados por `client_id` e, no CRM, por `owner` (vendedor vê os próprios + os do pool sem dono; gestor vê tudo).
- **CRON_SECRET** protege as rotas agendadas (`Authorization: Bearer`).

Detalhes de banco em [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md).
