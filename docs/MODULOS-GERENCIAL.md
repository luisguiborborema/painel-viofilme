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

### Núcleo transacional do Financeiro

Desde a migração `0149_nucleo_transacional.sql`, o módulo tem o modelo do documento-mãe (§5.2):

```
parties ──▶ documents ──▶ document_items   (categoria, cliente, centro de custo)
                 └─────▶ installments ──▶ settlements ──▶ transactions
                               └───────▶ charges
```

**A fonte de cada página é fixa** (§4 e invariante §23.1): Pagamentos e Recebimentos leem `installments`; Resultados lê `document_items` por competência; Caixa lê `transactions`. Valores em **centavos (`bigint`)**, nunca reais em `numeric`.

O **saldo da parcela é recalculado por gatilho no banco** (`recalcular_parcela`), não em código: a invariante "saldo = valor − Σ principal das baixas, nunca negativo" precisa valer para qualquer porta de escrita — rota, job, importação ou SQL no editor.

`expenses` e `payments` continuam existindo com os dados originais ("nada some", §23.7) e ainda alimentam o Dashboard e a página Financeiro antiga. Repontá-los para o núcleo é o próximo passo.

### Pagamentos — [/gerencial/financeiro/pagamentos](../src/app/gerencial/financeiro/pagamentos/)

O lugar de todo dinheiro que sai. Quatro abas: **Contas a pagar** (visões, chips, agrupamento por categoria ou forma, busca), **Folha**, **Recorrências** e **Fornecedores**.

A faixa de indicadores traz A pagar no mês, Pago, Vencido e Próximos 7 dias — este último com a **cobertura**: compara o saldo projetado dia a dia com o que há para pagar, porque o total sozinho não responde "dá para pagar?".

As regras vivem em [`pagamentos.ts`](../src/lib/data/pagamentos.ts), puras e testadas em [`tests/pagamentos.test.ts`](../tests/pagamentos.test.ts): ordem de prioridade do chip de situação, linha de pagamento, ação contextual, estimativa de valor, repartição do pagamento entre principal e encargos, fatura do cartão e separação do lote.

A **ficha da conta** (§7) abre pelo nome ou pela ação da linha, e traz os dois modais que operam sobre ela: **registrar pagamento** (§8) e **informar valor real** (§9). A escrita atravessa o núcleo inteiro — a baixa entra em `settlements`, o dinheiro que saiu vira `transactions` (`pending_confirmation` em conta com extrato, §13.3) e os dois são ligados por `reconciliation_links`. **O saldo e o status da parcela não são escritos pela rota**: o gatilho do banco recalcula.

**A regra do desconto merece destaque**, porque é contraintuitiva e foi onde apareceu um bug real: ao quitar pagando menos, o **principal é o saldo cheio** e o desconto vem ao lado como receita financeira. Se o principal fosse o dinheiro que saiu, o orçamento da categoria encolheria por causa de uma negociação — e, pior, a parcela não fecharia, já que só o principal abate o saldo. O caixa não se perde: a movimentação registra `principal − desconto + juros + multa`.

**Ainda não implementado desta spec**, e a tela não finge: leitura de boleto/NF por IA (§10.1), modo fatura do cartão (§6), drawer de nova despesa com prévia viva (§10), ações em lote (§5.8), anexo de documentos pela ficha e o ciclo completo da folha (§11).

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

Os **parâmetros de §13** (reserva mínima de caixa, antecedência do aviso de cobrança, dias de extrato parado, limites de conciliação, tolerância de orçamento e dia do fechamento) são editáveis em **Financeiro › Configurações**. Todos têm padrão — com a reserva em R$ 0 o caixa só vira alerta depois de ficar negativo; informe o piso real para ser avisado antes.

**Estado "Primeiro uso"**: enquanto faltar conta com saldo inicial ou cliente com fee mensal, os cinco blocos dão lugar ao checklist de implantação, cujos passos são derivados dos dados (sem flag manual).

Camadas: [`dashboard-financeiro.ts`](../src/lib/data/dashboard-financeiro.ts) e [`dashboard-panorama.ts`](../src/lib/data/dashboard-panorama.ts) (métricas e frases, puras e testadas em [`tests/dashboard-financeiro.test.ts`](../tests/dashboard-financeiro.test.ts) e [`tests/dashboard-panorama.test.ts`](../tests/dashboard-panorama.test.ts)); [`dashboard-financeiro-server.ts`](../src/lib/data/dashboard-financeiro-server.ts) e [`dashboard-panorama-server.ts`](../src/lib/data/dashboard-panorama-server.ts) (leitura). Precisa da migração `0148_dashboard_financeiro.sql`; sem ela a página funciona com os padrões de §13 e avisa.

**O que o modelo atual ainda não suporta**, e a tela não finge que suporta:
- não há `scheduled_payment_date` — a conta escolhida na despesa faz as vezes de "programado";
- não há recorrência de receita com data de reajuste, por isso **não existe a exceção I4**;
- não há baixa parcial: a baixa registra o saldo cheio da parcela;
- **não há emissão de cobrança** (o Asaas client só cria cliente e assinatura), então a ação "Enviar cobrança" de §8.3 não existe: uma entrada do Asaas oferece "Ver cobrança" e uma manual, a baixa;
- **juros, multa e desconto são informativos**: a ficha mostra o encargo que as regras configuradas implicam, mas a baixa grava o valor da parcela — onde o encargo entra na DRE é decisão do documento-mãe;
- **não há status "cancelada"** em parcela, então a ficha não tem "Cancelar parcela": o que existe no banco é `delete`, e apagar não é cancelar;
- **não há realtime** (§15 pede atualização ao vivo pelos webhooks do Asaas). O painel inteiro ainda não usa Supabase Realtime: a página carrega ao abrir e é revalidada após cada ação, que é o padrão do resto do projeto.

### Financeiro — [/gerencial/financeiro](../src/app/gerencial/financeiro/)
Fluxo de caixa (previsão), faturas pendentes com opção de cobrança, e DRE da agência. Integra pagamentos do **Asaas** (webhook [/api/webhooks/asaas](../src/app/api/webhooks/asaas/route.ts)). Dados via `getGerFinance()`.

### Planejamento — [/gerencial/financeiro/planejamento](../src/app/gerencial/financeiro/planejamento/)

A página do futuro, em três abas: **Orçamento** (o plano do ano contra o realizado, com farol de desvio), **Projeção** (onde o ano termina se nada mudar) e **Cenários** (e se…?).

**As três leem o mesmo motor.** A projeção é o cenário Base — não uma conta paralela. Fosse cada uma com a sua, "se continuar assim" discordaria de "onde o ano termina" estando as duas na mesma tela. O motor é [`simulacao.ts`](../src/lib/data/simulacao.ts), a biblioteca única de §10, testada em [`tests/simulacao.test.ts`](../tests/simulacao.test.ts).

As **quatro perguntas rápidas** de §9.1 (contratar, perder cliente, quanto vender, distribuir lucros) rodam no cliente porque são exploração: esperar o servidor a cada campo mataria a conversa que elas existem para ter. Nenhuma altera dado real.

**A projeção declara o que lhe falta.** Uma faixa lista as lacunas — sem colaboradores a folha entra zero, sem recorrências os fixos entram zero, sem alocação o aviso de capacidade fica desligado. E quando não há lado de custo nenhum, **resultado, margem e caixa aparecem como "—"**, não como número: com receita e sem custo a margem dá 100%, o que é correto pela conta e falso pelo negócio.

**Ainda não implementado desta spec:** o assistente "Montar o orçamento" (§7, 6 passos), a revisão do mês (§6, 3 passos), o gráfico de caixa por cenário (§9.2), a edição de alavancas inline e a criação de eventos previstos pela tela (§8.5 — a lista já lê de `forecast_events`).

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
