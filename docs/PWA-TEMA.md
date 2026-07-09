# PWA, Notificações e Tema

Recursos de aplicativo instalável, notificações e aparência.

---

## 1. PWA / Service Worker

O painel é um **PWA instalável**. O service worker [public/sw.js](../public/sw.js) usa estratégia cache-first com fallback offline:

- **Install/Activate:** precache de `offline.html` e ícones; limpa caches antigos (cache `viofilme-v1`).
- **Navegações:** network-first → se offline, serve `offline.html`.
- **Estáticos** (`/_next/`, ícones, fontes, imagens): stale-while-revalidate (serve do cache e revalida em background).
- **Push:** listener pronto que decodifica o payload JSON e exibe a notificação; clique abre/foca a janela e navega para `data.url`.

O worker é servido **sem cache** e com MIME correto via headers em [next.config.ts](../next.config.ts).

### Instalação
[src/components/pwa/](../src/components/pwa/) registra o worker (só em produção) e trata o prompt de instalação:
- Android/Chrome: captura `beforeinstallprompt` e mostra "Instalar app".
- iOS: detecta o Safari e mostra instruções (Compartilhar → "Adicionar à Tela de Início").
- Já instalado (`standalone`): não mostra prompt.
- Preferência de dispensa guardada via `usePersistentState` para não repetir.

---

## 2. Notificações (Web Push + WhatsApp)

Dois canais disparados juntos pelos gatilhos em [src/lib/push/triggers.ts](../src/lib/push/triggers.ts):

1. **Web Push** (VAPID) via biblioteca `web-push` — para o navegador dos usuários inscritos (tabela `push_subscriptions`).
2. **WhatsApp** (Uazapi) — para o número do cliente ou da equipe.

Fluxo:
- Cliente se inscreve → [/api/push/subscribe](../src/app/api/push/subscribe/route.ts) grava a subscription.
- Teste manual → [/api/push/test](../src/app/api/push/test/route.ts).
- Desinscrição → [/api/push/unsubscribe](../src/app/api/push/unsubscribe/route.ts).
- Gatilhos automáticos → [/api/cron/notifications](../src/app/api/cron/notifications/route.ts) (cron diário): lembretes de reunião, updates recorrentes, tarefas atrasadas, alertas.

Eventos cobertos: aprovação de conteúdo, relatório pronto, lembrete de reunião, fatura/pagamento, risco de churn, tarefas vencendo, banco de horas excedido, solicitações do portal, falha em update recorrente.

Configuração e detalhes em [APIS.md](APIS.md#17-web-push--vapid). Env vars: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`.

---

## 3. Tema (claro / escuro)

[src/components/theme/](../src/components/theme/) provê um tema com três preferências:

- **`system`** (padrão) — segue o `prefers-color-scheme` do SO, em tempo real.
- **`light`** — força claro.
- **`dark`** — força escuro.

Detalhes:
- Preferência salva em `localStorage` (`vio-theme`).
- Um script inline no `<head>` ([app/layout.tsx](../src/app/layout.tsx)) aplica a classe `theme-dark` **antes** do primeiro paint, evitando flash.
- O toggle cicla Automático → Claro → Escuro.
- O CSS usa `html.theme-dark { … }` com variáveis por tema.
