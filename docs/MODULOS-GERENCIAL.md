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

### Dashboard financeiro — [/gerencial/financeiro/dashboard](../src/app/gerencial/financeiro/dashboard/)
A janela para o macro do Financeiro. Responde, nesta ordem: "tem algum problema para resolver hoje?" e "a empresa está saudável agora?". Página única para todos os perfis do módulo, sempre no presente — **sem filtro de período ou de conta**.

Cinco blocos:
1. **Precisa da sua atenção** — exceções derivadas (E1–E8, I1–I3). Não existe tabela de alertas: cada linha é uma consulta sobre o estado atual e some sozinha quando o problema é resolvido. Crítico e atenção não podem ser dispensados; avisos podem ser silenciados por 7 dias, por usuário e por escopo.
2. **Pulso** — saldo disponível (popover por conta), caixa projetado em 30 dias, resultado do mês por competência e a divisão entre MRR e receita pontual.
3. **Entradas e saídas** — dois painéis espelhados com o ritmo dos últimos e próximos 7 dias, aging dos vencidos e composição expansível.
4. **Esta semana** — o que vence de hoje a +7 dias, em quadro de altura fixa com rolagem interna. Abre a **ficha universal** pelo nome e a **baixa rápida** pela ação. Vencidos ficam de fora: já estão no bloco 1.
5. **Panorama** — carrossel de 4 visões (caixa em 30 dias, composição da receita, resultado em 6 meses, para onde vai o dinheiro). Cada uma traz a **conclusão escrita**, gerada por regra no servidor, sem IA.

Todo número linka para o destino **já filtrado** (`?aba=` e `?status=`, lidos por `FinanceTabs` e `ResultadosTabs`). Nenhum cálculo acontece no front.

**As ações escrevem pelos endpoints das páginas de origem** (`/api/gerencial/expenses` e `/api/gerencial/receivables`), nunca por um caminho próprio. É o que faz a baixa feita aqui passar pela alçada de aprovação, pela trava de período fechado e pela auditoria — não existe atalho sem registro.

**Estado "Primeiro uso"**: enquanto faltar conta com saldo inicial ou cliente com fee mensal, os cinco blocos dão lugar ao checklist de implantação, cujos passos são derivados dos dados (sem flag manual).

Camadas: [`dashboard-financeiro.ts`](../src/lib/data/dashboard-financeiro.ts) e [`dashboard-panorama.ts`](../src/lib/data/dashboard-panorama.ts) (métricas e frases, puras e testadas em [`tests/dashboard-financeiro.test.ts`](../tests/dashboard-financeiro.test.ts) e [`tests/dashboard-panorama.test.ts`](../tests/dashboard-panorama.test.ts)); [`dashboard-financeiro-server.ts`](../src/lib/data/dashboard-financeiro-server.ts) e [`dashboard-panorama-server.ts`](../src/lib/data/dashboard-panorama-server.ts) (leitura). Precisa da migração `0148_dashboard_financeiro.sql`; sem ela a página funciona com os padrões de §13 e avisa.

**O que o modelo atual ainda não suporta**, e a tela não finge que suporta:
- não há `scheduled_payment_date` — a conta escolhida na despesa faz as vezes de "programado";
- não há recorrência de receita com data de reajuste, por isso **não existe a exceção I4**;
- não há baixa parcial: a baixa registra o saldo cheio da parcela;
- **não há emissão de cobrança** (o Asaas client só cria cliente e assinatura), então a ação "Enviar cobrança" de §8.3 não existe: uma entrada do Asaas oferece "Ver cobrança" e uma manual, a baixa;
- **juros, multa e desconto são informativos**: a ficha mostra o encargo que as regras configuradas implicam, mas a baixa grava o valor da parcela — onde o encargo entra na DRE é decisão do documento-mãe;
- **não há status "cancelada"** em parcela, então a ficha não tem "Cancelar parcela": o que existe no banco é `delete`, e apagar não é cancelar.

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
