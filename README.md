# Painel Viofilme

Dashboard da agência **Viofilme** com dois níveis de acesso:

- **Gerencial** (agência) — visão consolidada de todos os clientes, campanhas, conteúdo, resultados e integrações.
- **Cliente** — cada cliente vê apenas o próprio Instagram/Facebook: conteúdo, campanhas e resultados.

Stack: **Next.js 16** (App Router) · **TypeScript** · **Tailwind CSS v4** · **Supabase** (auth + banco) · **Meta Graph API** (Instagram/Facebook) · **Recharts**.

---

## 🚀 Rodar agora (modo demo)

Sem nenhuma configuração, o painel já roda com dados de demonstração:

```bash
npm install
npm run dev
```

Acesse http://localhost:3000 → você cai na tela de login com dois atalhos:

| Acesso     | E-mail                      | Senha      |
| ---------- | --------------------------- | ---------- |
| Gerencial  | `gerencial@viofilme.com.br` | `viofilme` |
| Cliente    | `cliente@viofilme.com.br`   | `viofilme` |

> O **modo demo** usa dados fictícios e um cookie de sessão simples. Serve para
> visualizar a interface. Para produção, configure o Supabase (abaixo).

---

## 🔐 Modo produção — Supabase

1. Crie um projeto em [app.supabase.com](https://app.supabase.com).
2. Copie `.env.example` para `.env.local` e preencha:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Rode a migração SQL em **SQL Editor** (ou via CLI):
   - `supabase/migrations/0001_init.sql`
4. Crie os usuários em **Authentication → Users** e ajuste o papel/cliente na
   tabela `profiles` (o gatilho `handle_new_user` cria o perfil automaticamente
   como `cliente`; mude para `gerencial` ou vincule um `client_id` conforme o caso).

Assim que as variáveis do Supabase estiverem preenchidas, o painel troca
automaticamente do modo demo para autenticação e dados reais.

### Modelo de dados (resumo)

- `clients` — empresas atendidas
- `profiles` — usuários (papel `gerencial`/`cliente` + `client_id`)
- `meta_connections` — tokens OAuth da Meta por cliente
- `campaigns` + `campaign_metrics` — campanhas e métricas diárias
- `content_posts` — posts publicados/agendados
- `account_metrics` — seguidores/alcance diários por plataforma

RLS isola tudo por cliente: gerencial vê/edita tudo; cliente só o próprio `client_id`.

---

## 📲 Integração Meta (Instagram + Facebook)

1. Crie um app **Business** em [developers.facebook.com](https://developers.facebook.com/apps).
2. Adicione os produtos **Facebook Login** e **Instagram Graph API**.
3. Em *Facebook Login → Settings*, registre a URL de redirecionamento OAuth:
   ```
   http://localhost:3000/api/meta/callback        (dev)
   https://SEU_DOMINIO/api/meta/callback          (prod)
   ```
4. Solicite em **App Review** as permissões: `pages_show_list`,
   `pages_read_engagement`, `instagram_basic`, `instagram_manage_insights`,
   `read_insights`, `ads_read`.
5. Preencha no `.env.local`:
   - `NEXT_PUBLIC_META_APP_ID`
   - `META_APP_SECRET`
   - `NEXT_PUBLIC_APP_URL`

Depois, em **Gerencial → Integrações**, clique em *Conectar* no cliente desejado.
O fluxo OAuth (`/api/meta/connect` → `/api/meta/callback`) troca o code por um
token de longa duração e salva em `meta_connections`.

> **Próximo passo após conectar:** criar um job de sincronização que use as
> funções de `src/lib/meta/client.ts` para buscar mídias e insights da Graph API
> e popular `content_posts`, `account_metrics` e `campaign_metrics`. Hoje as telas
> leem de `src/lib/data/` (mock) — basta trocar a implementação das funções de
> `src/lib/data/queries.ts` para consultar o Supabase.

---

## 🗂️ Estrutura

```
src/
├─ app/
│  ├─ login/                 # tela de login (+ atalhos demo)
│  ├─ gerencial/             # área da agência (layout protegido por papel)
│  │  ├─ clientes/ campanhas/ conteudo/ resultados/ integracoes/
│  ├─ cliente/               # área do cliente (layout protegido por papel)
│  │  ├─ conteudo/ campanhas/ resultados/
│  └─ api/meta/              # rotas OAuth da Meta (connect + callback)
├─ components/
│  ├─ brand/                 # logos (currentColor) + ícones sociais
│  ├─ shell/                 # sidebar, topbar, app-shell
│  ├─ dashboard/             # KPIs, gráficos, tabelas, grade de conteúdo
│  └─ ui/                    # card, badge, button
├─ lib/
│  ├─ auth/                  # sessão, papéis, login/logout, demo
│  ├─ supabase/              # clients browser/server + proxy de sessão
│  ├─ meta/                  # config + cliente da Graph API
│  └─ data/                  # tipos, mock e queries (camada de dados)
└─ proxy.ts                  # proteção de rotas (ex-"middleware")
supabase/migrations/         # schema + RLS
```

---

## 🎨 Identidade

Paleta e logos da Viofilme (em `Logos/` e `public/brand/`):

- Azul `#2a63c9` · Lima `#e9fc89` · Creme `#f9e5d8` · Salmão `#f2a4ad`
- Tipografia: **Barlow**

## Scripts

```bash
npm run dev      # desenvolvimento
npm run build    # build de produção
npm run start    # servir o build
npm run lint     # lint
```
