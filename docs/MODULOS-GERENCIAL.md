# Módulos da Área Gerencial

Cada tela da área da agência (`/gerencial/*`), o que faz e de onde vêm os dados. A visibilidade de cada módulo depende do RBAC do usuário (ver [AUTENTICACAO.md](AUTENTICACAO.md)).

O menu é organizado em quatro grupos: **Comercial**, **Operacional**, **Gestão** e **Conta** ([src/lib/nav.ts](../src/lib/nav.ts)).

---

## Comercial

### CRM & Vendas — [/gerencial/crm](../src/app/gerencial/crm/)
Funil de aquisição completo, em abas: **Dashboard** (resumo do mês), **Pipeline** (Kanban de leads por estágio), **Tarefas** (com badge de pendências), **Empresas**, **Contatos**, **Metas** (forecast de fechamento por vendedor), **Análise** (velocidade de estágio, histórico de conversão) e **Configurações** (pipelines, estágios, tags, propriedades customizadas, formulários de captura, automações e fluxos de tarefas). Os leads têm scoring de probabilidade (0–100), qualificação BANT, timeline de interações omni-channel e automação de tarefas ao mudar de estágio. Integra com Google Agenda para mostrar a agenda do dia. Dados via `getCrmDashboard()`, `getCrmLeads()`, `getCrmTasks()`, `getCrmGoals()`.

- **Deal — [/gerencial/crm/[id]](../src/app/gerencial/crm/[id]/)**: ficha do negócio com interações, tarefas, empresa, contatos do deal, tags, propriedades customizadas, motivo de perda e histórico de movimentação entre estágios. Permite gerar proposta em PDF e enviar por WhatsApp.
- **Contato — [/gerencial/crm/contato/[id]](../src/app/gerencial/crm/contato/[id]/)**: ficha da pessoa, empresa associada, deals vinculados, tags e interações.
- **Empresa — [/gerencial/crm/empresa/[id]](../src/app/gerencial/crm/empresa/[id]/)**: ficha da organização, contatos, deals abertos/fechados e tags (visão 360°).

Leads também entram por **formulário público** ([/captura/[slug]](../src/app/captura/[slug]/)) via [/api/public/lead](../src/app/api/public/lead/route.ts).

### Atendimento (Inbox) — [/gerencial/inbox](../src/app/gerencial/inbox/)
Central de WhatsApp ao vivo (estilo Kommo): lista de conversas com filtros por atendente e status (aberta/pendente/resolvida), thread de mensagens (texto, áudio, imagem, documento), atribuição de atendente e contador de não lidas. Recebe mensagens pelo webhook [/api/webhooks/uazapi](../src/app/api/webhooks/uazapi/route.ts) e envia por [/api/inbox/send](../src/app/api/inbox/send/route.ts) e [send-media](../src/app/api/inbox/send-media/route.ts). Conversas podem ser associadas a leads do CRM. Dados via `getConversations()` / `getAttendants()`.

### Agenda — [/gerencial/agenda](../src/app/gerencial/agenda/)
Calendário da agência sincronizado com **Google Calendar**, agrupado por dia com horário, participantes e link do Google Meet. Verifica conexão via `getGoogleStatus()` e lista eventos com `listUpcomingEvents()` (até 30 dias); sem conexão, cai em agenda mock. Reuniões são criadas a partir do CRM ([/api/crm/schedule](../src/app/api/crm/schedule/route.ts)).

---

## Operacional

### Hub de Clientes — [/gerencial/clientes](../src/app/gerencial/clientes/)
Visão operacional dos clientes ativos — a "mesa" de cada um: tarefas atrasadas, itens em aprovação, funil de produção, contrato e responsáveis por função. Dados via `getHubClientsOps()`.

- **Detalhe — [/gerencial/clientes/[id]](../src/app/gerencial/clientes/[id]/)**: raio-X do cliente em abas — Resumo (urgências, produção, contrato), Metas, Tarefas, Linha Editorial (briefing + estratégia), Criativos de Performance, VioLaunch (onboarding/estudo do negócio), VioDay, Agenda e Documentos. Dados via `getCSClientDetail()`, `getClientTasks()`, `getVioLaunch()`.

### Painel de Entregas — [/gerencial/entregas](../src/app/gerencial/entregas/)
"A cozinha" da operação: tarefas do dia por cliente, termômetro de carga por pessoa (%), gargalos de aprovação e status de entrega em tempo real. Dados via `getDeliveryTasks()`.

### VioFlux (Conteúdo) — [/gerencial/conteudo](../src/app/gerencial/conteudo/)
Esteira de produção de conteúdo: rascunho → pronto → aprovação do cliente → publicado. Filtra por responsável ("meus clientes") e mostra a fase de cada peça. Dados via `getHubClientsOps()`.

### Gestão à Vista — [/gerencial/gestao-a-vista](../src/app/gerencial/gestao-a-vista/)
Painel analítico com três lentes: **Tráfego** (conversões, CPL, CTR por responsável), **Social** (crescimento, engajamento) e **Liderança** (saúde da carteira: MRR vs meta, vocação do cliente). Colaboradores sem acesso nominal veem só as próprias métricas. Combina `getGoalsForPeriod()` + `getClients()` com métricas Meta. As antigas rotas `/gerencial/campanhas` e `/gerencial/resultados` **redirecionam** para cá.

### Central de Relatórios — [/gerencial/relatorios](../src/app/gerencial/relatorios/)
Dois espaços: (1) **relatórios sob demanda** — gera PDF por cliente e pode enviar por WhatsApp ([/api/reports/send](../src/app/api/reports/send/route.ts)); (2) **updates automáticos** — configura envios recorrentes (diário/semanal/mensal) com KPIs, disparados pelo cron ([/api/cron/notifications](../src/app/api/cron/notifications/route.ts)). Dados via `getClients()` + `recurring.ts`.

### Playbooks — [/gerencial/documentos](../src/app/gerencial/documentos/)
Biblioteca de processos e padrões da agência, organizada por **setor**, com documentos em **Markdown ou HTML** e anexos (PDF/imagem). CRUD via [/api/gerencial/playbooks](../src/app/api/gerencial/playbooks/route.ts) e upload por [/playbooks/upload](../src/app/api/gerencial/playbooks/upload/route.ts). Dados via `getPlaybookSectors()`.

---

## Gestão

### Visão geral — [/gerencial](../src/app/gerencial/)
Dashboard executivo (C-Level): KPIs da agência (receita, lead score, pipeline), alertas operacionais por prioridade, histórico de MRR com meta de escala, saúde de contas, carga do time, DRE e funil comercial. Dados via `getCLevel()`.

### Financeiro — [/gerencial/financeiro](../src/app/gerencial/financeiro/)
Fluxo de caixa (previsão), faturas pendentes com opção de cobrança, e DRE da agência. Integra pagamentos do **Asaas** (webhook [/api/webhooks/asaas](../src/app/api/webhooks/asaas/route.ts)). Dados via `getGerFinance()`.

### RH & Cultura — [/gerencial/rh](../src/app/gerencial/rh/)
Gestão de pessoas: **Time** (carga semanal), **Banco de Horas**, **PDIs**, **Avaliações** (ciclo semestral), **Mural** e **Documentos**. Dados via `getEmployees()`, `getHourBank()`, `getPdiCycle()`, `getReviewCycle()`.

- **Detalhe — [/gerencial/rh/[id]](../src/app/gerencial/rh/[id]/)**: ficha do colaborador (contrato, banco de horas, documentos, PDI do trimestre, última avaliação, histórico). Dados via `getEmployeeProfile()`.

### Integrações — [/gerencial/integracoes](../src/app/gerencial/integracoes/)
Central de conectores: **Google Agenda** (conta única da agência) e **Meta Graph API** (Instagram + Facebook por cliente), com status de conexão, botões Conectar/Reconectar e guias de setup. Dispara os fluxos OAuth ([/api/google/connect](../src/app/api/google/connect/route.ts), [/api/meta/connect](../src/app/api/meta/connect/route.ts)) e a sincronização Meta.

---

## Conta

### Configurações — [/configuracoes](../src/app/configuracoes/)
Preferências da conta (perfil, tema, notificações push, gestão de time para gestores). Compartilhada entre gerencial e cliente.

---

## Rotas que redirecionam
- `/gerencial/campanhas` → `/gerencial/gestao-a-vista`
- `/gerencial/resultados` → `/gerencial/gestao-a-vista`
