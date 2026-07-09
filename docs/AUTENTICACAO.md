# Autenticação, Sessão e Controle de Acesso

Como o painel autentica usuários, mantém sessão e restringe o que cada um vê.

Arquivos: [src/lib/auth/](../src/lib/auth/), [src/lib/access.ts](../src/lib/access.ts), [src/proxy.ts](../src/proxy.ts), [src/lib/supabase/middleware.ts](../src/lib/supabase/middleware.ts).

---

## 1. Papéis

Dois papéis (`Role` em [types.ts](../src/lib/auth/types.ts)):

- **`gerencial`** — equipe da agência. Acesso às seções administrativas conforme RBAC.
- **`cliente`** — vê apenas o portal do próprio cliente (`clientId`).

O usuário autenticado é normalizado no tipo `SessionUser`, com os mesmos campos independentemente da origem (demo ou Supabase):

```ts
SessionUser = {
  id, email, name, role,
  clientId, clientName,     // preenchidos para cliente
  avatarUrl,
  allowedSections,          // RBAC gerencial: null = acesso total
  teamRole,                 // rótulo (gestor/financeiro/rh/social/trafego/cs)
}
```

---

## 2. Fluxo de login

1. A tela [/login](../src/app/login/) chama a Server Action `signIn()` em [actions.ts](../src/lib/auth/actions.ts) com e-mail/senha.
2. **Se o Supabase está configurado** → autentica via Supabase Auth (JWT + cookies de sessão).
3. **Se não** → `authenticateDemo()` ([demo.ts](../src/lib/auth/demo.ts)) valida contra credenciais fixas e grava um cookie httpOnly `vio_demo_session`.
4. Redireciona por papel: gerencial → `/gerencial` (ou primeira seção permitida), cliente → `/cliente`.

`getSession()` em [session.ts](../src/lib/auth/session.ts) é o ponto único que devolve o `SessionUser`: lê o JWT (`getClaims()` — validação local em produção), consulta `profiles` e monta o objeto normalizado.

### Definir/redefinir senha
A rota [/definir-senha](../src/app/definir-senha/) trata a definição de senha (primeiro acesso e reset), usando o link temporário do Supabase Auth. A gestão de time pode disparar `send_reset_email` via [/api/gerencial/team](../src/app/api/gerencial/team/route.ts).

---

## 3. RBAC — controle por seção (gerencial)

Definido em [src/lib/access.ts](../src/lib/access.ts). Cada usuário gerencial tem `allowedSections`:

- **`null`** → **acesso total (Gestor)**.
- **array** → restrito às seções listadas.

Seções (`SectionKey`): `visao-geral`, `crm`, `clientes`, `entregas`, `campanhas`, `conteudo`, `resultados`, `relatorios`, `rh`, `financeiro`, `integracoes`.

### Templates de time (`TEAM_TEMPLATES`)

| Template | Seções |
|----------|--------|
| **Gestor** | todas (`null`) |
| **Comercial / BDR** | crm, clientes |
| **Financeiro** | financeiro |
| **RH & cultura** | rh |
| **Social Media** | clientes, conteudo, resultados, entregas |
| **Tráfego** | clientes, campanhas, resultados, relatorios |
| **Customer Success** | clientes, relatorios, financeiro |
| **Personalizado** | escolha manual |

### Helpers principais
- `hasFullAccess(allowed)` — é Gestor? (`allowed == null`)
- `canAccessSection(allowed, section)` — pode ver a seção?
- `canAccessPath(allowed, pathname)` — pode acessar a rota? (trata rotas combinadas, ex. Gestão à Vista = campanhas **ou** resultados)
- `firstAllowedHref(allowed)` — para onde redirecionar no login
- `pathToSection(pathname)` — mapeia URL → seção

O menu ([nav.ts](../src/lib/nav.ts)) usa esses helpers para esconder itens sem permissão; o layout gerencial usa `canAccessPath` para bloquear acesso direto por URL.

---

## 4. Proteção de rotas (middleware)

[src/proxy.ts](../src/proxy.ts) roda em toda requisição:

1. Chama `updateSession()` ([middleware.ts](../src/lib/supabase/middleware.ts)) que **renova o token** do Supabase e sincroniza cookies.
2. Rota protegida (`/gerencial`, `/cliente`) sem sessão → redirect `/login?next=<rota>`.
3. Usuário já logado tentando abrir `/login` → redirect para a home do seu papel.

A validação de token usa `getClaims()` (verificação local do JWT, sem round-trip ao Auth em cada request).

---

## 5. Camadas de segurança (resumo)

| Camada | Onde | O que protege |
|--------|------|---------------|
| Middleware | `proxy.ts` | Exige sessão para áreas privadas |
| RBAC de seção | `access.ts` + layout gerencial | Restringe seções por `allowedSections` |
| Autorização nas rotas | `src/app/api/*` | Revalida papel/acesso antes de escrever |
| RLS (Postgres) | migrations Supabase | Isola por `client_id` e por `owner` (CRM) |
| Service role | só servidor | Webhooks/cron/Storage sem sessão |

Detalhes de RLS em [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md).
