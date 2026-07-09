# Documentação — Painel Viofilme

Central de documentação técnica e funcional do **Painel Viofilme**, o dashboard da agência com dois níveis de acesso (Gerencial e Cliente).

> **Make it happen.** — Comunicação, performance e branding com processo estruturado.

---

## O que é

Plataforma web (PWA) que unifica a operação da agência Viofilme em um só lugar:

- **Área Gerencial (agência):** CRM & vendas, atendimento WhatsApp, agenda, hub de clientes, entregas, produção de conteúdo, gestão à vista, relatórios, financeiro, RH, playbooks e integrações.
- **Portal do Cliente:** cada cliente vê apenas o próprio Instagram/Facebook — conteúdo, campanhas, resultados, financeiro e central de marca, com a IA **Bruna** para tirar dúvidas.

O sistema opera em **dois modos automáticos**: sem variáveis de ambiente configuradas roda em **modo demo** (dados fictícios + login simulado); com Supabase preenchido, troca para **dados reais**.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Framework | **Next.js 16** (App Router, Server Components, Server Actions) |
| Linguagem | **TypeScript** |
| UI | **Tailwind CSS v4**, componentes próprios, `lucide-react`, `recharts` |
| Auth + Banco + Storage | **Supabase** (Postgres + RLS + Auth + Storage) |
| Redes sociais | **Meta Graph API** (Instagram + Facebook Ads) |
| IA | **OpenAI** (chat Bruna/Cadu + insights) |
| Financeiro | **Asaas** (webhook de pagamentos) |
| WhatsApp | **Uazapi** (inbox ao vivo + notificações) |
| Agenda | **Google Calendar API** |
| Notificações | **Web Push / VAPID** + PWA (service worker) |
| PDFs | `jspdf`, `pdf-lib`, `html2canvas`, `marked` |
| Deploy | **Vercel** (+ Vercel Cron) |

---

## Índice da documentação

| Documento | Conteúdo |
|-----------|----------|
| [ARQUITETURA.md](ARQUITETURA.md) | Visão geral técnica, estrutura de pastas, modo demo vs produção, fluxo de request |
| [AUTENTICACAO.md](AUTENTICACAO.md) | Login, sessão, papéis (gerencial/cliente), RBAC por seção, proteção de rotas |
| [CAMADA-DE-DADOS.md](CAMADA-DE-DADOS.md) | Padrão dual-mode (mock/Supabase), mapa dos arquivos de dados |
| [BANCO-DE-DADOS.md](BANCO-DE-DADOS.md) | Schema completo do Postgres/Supabase, tabelas, RLS, enums, triggers |
| [MODULOS-GERENCIAL.md](MODULOS-GERENCIAL.md) | Cada módulo da área da agência (CRM, Inbox, Clientes, Entregas, etc.) |
| [PORTAL-CLIENTE.md](PORTAL-CLIENTE.md) | As telas que o cliente vê |
| [APIS.md](APIS.md) | Todas as APIs — serviços externos + rotas internas `/api/*` |
| [BACKEND.md](BACKEND.md) | Guia para sair do modo demo (Supabase + Meta + IA) |
| [PWA-TEMA.md](PWA-TEMA.md) | Service worker, instalação PWA, push, tema claro/escuro |
| [DEPLOY.md](DEPLOY.md) | Deploy no Vercel, variáveis de ambiente, cron jobs |

---

## Começar rápido

```bash
npm install
npm run dev          # http://localhost:3000
```

Login demo:

| Acesso | E-mail | Senha |
|--------|--------|-------|
| Gerencial | `gerencial@viofilme.com.br` | `viofilme` |
| Cliente | `cliente@viofilme.com.br` | `viofilme` |

Para dados reais, siga o [BACKEND.md](BACKEND.md) e o [DEPLOY.md](DEPLOY.md).

---

## Identidade

- Paleta: Azul `#2a63c9` · Lima `#e9fc89` · Creme `#f9e5d8` · Salmão `#f2a4ad`
- Tipografia: **Barlow**
- Logos em [`Logos/`](../Logos/) e [`public/brand/`](../public/brand/)
