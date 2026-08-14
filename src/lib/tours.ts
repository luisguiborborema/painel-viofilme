/**
 * Registro de tutoriais guiados por rota. Cada tour tem um id estável (usado no
 * localStorage para abrir uma única vez no primeiro acesso), um match de rota e
 * uma lista de passos. Cada passo aponta para um elemento via seletor CSS
 * (normalmente um atributo data-tour="..."); sem seletor, o passo vira um cartão
 * central (bom para intro/encerramento).
 *
 * Para adicionar um tutorial a uma página: 1) coloque data-tour="chave" nos
 * elementos-âncora dessa tela; 2) acrescente uma entrada em TOURS aqui. A ordem
 * importa — o PRIMEIRO match vale, então rotas específicas vêm antes das gerais.
 */
export type TourStep = {
  /** Seletor CSS do elemento a destacar. Omita para um cartão central. */
  selector?: string;
  title: string;
  body: string;
};

export type Tour = {
  id: string;
  title: string;
  match: RegExp;
  steps: TourStep[];
};

export const TOURS: Tour[] = [
  // Ficha do cliente (Hub) — vale para qualquer aba do cliente.
  {
    id: "hub-cliente",
    title: "Ficha do cliente",
    match: /^\/gerencial\/clientes\/[^/]+(\/|$)/,
    steps: [
      {
        title: "Ficha do cliente",
        body: "Aqui fica tudo de uma conta. O cabeçalho aparece em todas as abas; abaixo dele você navega entre Resumo, Metas, Tarefas, Linha editorial e mais.",
      },
      {
        selector: '[data-tour="client-tabs"]',
        title: "Abas da conta",
        body: "Alterna entre as áreas do cliente: Resumo (visão geral), Linha editorial (conteúdo), Criativos de performance (tráfego), Agenda, entre outras.",
      },
      {
        selector: '[data-tour="client-quickactions"]',
        title: "Ações rápidas",
        body: "Abrir o portal do cliente, copiar o link, enviar um formulário já vinculado, gerar o relatório do mês em PDF e acessar o Drive de ativos.",
      },
      {
        selector: '[data-tour="client-manage"]',
        title: "Gestão da conta",
        body: "Mandar briefing (gera o brief de Social e de Performance pronto pra enviar ao squad), trocar os Responsáveis (uma ou várias pessoas por função) e editar Serviços & entregáveis do mês.",
      },
    ],
  },

  // CRM Comercial — pipeline de negócios.
  {
    id: "comercial-pipeline",
    title: "Pipeline comercial",
    match: /^\/gerencial\/comercial(\/pipeline)?\/?$/,
    steps: [
      {
        title: "Pipeline de negócios",
        body: "O quadro de vendas no estilo HubSpot. Cada coluna é uma etapa; arraste um card para avançar o negócio. Vamos ver os controles principais.",
      },
      {
        selector: '[data-tour="pipeline-metrics"]',
        title: "Métricas do funil",
        body: "Valor total, ponderado (valor × probabilidade da etapa), aberto, fechado, novo do mês e idade média. Dá pra ocultar essa faixa quando quiser foco no quadro.",
      },
      {
        title: "Filtros e visões",
        body: "Filtre por Proprietário, Cliente, Origem, Etapa e Prioridade. Salve combinações como visualizações em '+ Adicionar visualização' para reusar depois.",
      },
      {
        title: "Automação e relatórios",
        body: "Em Configurações você monta Workflows (automações), Propriedades e Lead scoring; em Insights ficam os Relatórios e Dashboards. Quer detalhes? É só me perguntar aqui no chat.",
      },
    ],
  },

  // Configurações do CRM Comercial (propriedades, workflows, lead score...).
  {
    id: "comercial-configuracoes",
    title: "Configurações do Comercial",
    match: /^\/gerencial\/comercial\/configuracoes/,
    steps: [
      {
        selector: '[data-tour="page-header"]',
        title: "Configurações do Comercial",
        body: "A fonte única de configuração do CRM. Tudo do módulo Comercial se ajusta aqui.",
      },
      {
        selector: '[data-tour="crmset-nav"]',
        title: "Seções",
        body: "Navegue pelos grupos: Personalização (layout do card, Propriedades, Tags), Funil (Pipelines & estágios, Fluxos de automação, Cadências, Motivos de perda), Metas & Score (Lead score), Aquisição (Formulários e briefings) e mais.",
      },
      {
        title: "Workflows (automação)",
        body: "Em 'Fluxos de automação' você cria automações: um gatilho (entrada em etapa, criação, mudança de propriedade ou data atingida) dispara ações (tarefa, WhatsApp, espera, mover etapa, condição if/then, webhook…).",
      },
      {
        title: "Propriedades e Lead score",
        body: "'Propriedades customizadas' cria campos próprios (com grupos). 'Regras de lead score' pontua os negócios automaticamente conforme critérios que você define.",
      },
    ],
  },

  // Insights do Comercial — análise, metas e relatórios.
  {
    id: "comercial-insights",
    title: "Insights do Comercial",
    match: /^\/gerencial\/comercial\/insights/,
    steps: [
      {
        selector: '[data-tour="page-header"]',
        title: "Insights do Comercial",
        body: "Análise do funil, metas do time e relatórios personalizados — tudo em abas.",
      },
      {
        selector: '[data-tour="insights-tabs"]',
        title: "Abas",
        body: "Análise (funil e tempo por etapa), Metas (previsão e distribuição do mês) e Relatórios (dashboards personalizados).",
      },
      {
        title: "Relatórios & Dashboards",
        body: "Na aba Relatórios você monta vários dashboards como abas. Cada relatório escolhe agrupamento (proprietário/origem/etapa/mês), métrica (contagem/valor/ponderado) e tipo de gráfico (barras, pizza, linha, número).",
      },
    ],
  },

  // Hub de clientes — a LISTA (não a ficha [id]).
  {
    id: "clientes-lista",
    title: "Hub de clientes",
    match: /^\/gerencial\/clientes\/?$/,
    steps: [
      {
        title: "Hub de clientes",
        body: "A mesa de trabalho da carteira: cada cliente com o que precisa resolver hoje. Clique num cliente para abrir a ficha completa.",
      },
      {
        selector: '[data-tour="hub-escopo"]',
        title: "Meus / Squad / Todos",
        body: "Filtra a carteira que você vê: só suas contas, as do seu squad ou todas.",
      },
      {
        selector: '[data-tour="hub-filtros"]',
        title: "Filtros",
        body: "Refine por status, responsável e serviço. Use a busca para achar um cliente rápido, e o botão 'Novo cliente' para cadastrar.",
      },
    ],
  },

  // Meu dia — início do dia.
  {
    id: "meu-dia",
    title: "Meu dia",
    match: /^\/gerencial\/meu-dia/,
    steps: [
      {
        title: "Meu dia",
        body: "Sua tela de início: o que precisa da sua atenção hoje, num lugar só.",
      },
      {
        selector: '[data-tour="md-kpis"]',
        title: "Resumo do dia",
        body: "Tarefas atrasadas, para hoje, reuniões do dia e solicitações abertas — em números.",
      },
      {
        selector: '[data-tour="md-atalhos"]',
        title: "Atalhos",
        body: "Pulo rápido para Painel de Entregas, Agenda, Pipeline e Solicitações.",
      },
    ],
  },

  // Inbox — atendimento.
  {
    id: "inbox",
    title: "Inbox",
    match: /^\/gerencial\/inbox/,
    steps: [
      {
        title: "Atendimento (Inbox)",
        body: "Central de conversas (WhatsApp e mais): leia, responda e direcione atendimentos sem sair do painel.",
      },
      {
        selector: '[data-tour="inbox-status"]',
        title: "Status das conversas",
        body: "Filtre por Abertas, Pendentes e Resolvidas. Ao lado dá para filtrar por atendente e por canal.",
      },
      {
        title: "Responder e direcionar",
        body: "Abra uma conversa na coluna central para responder pelo compositor; à direita fica o controle de atendentes.",
      },
    ],
  },

  // Financeiro.
  {
    id: "financeiro",
    title: "Financeiro",
    match: /^\/gerencial\/financeiro/,
    steps: [
      {
        title: "Financeiro",
        body: "Fluxo de caixa, cobrança e DRE da agência. No topo você troca o período, exporta e cria uma 'Nova cobrança'.",
      },
      {
        selector: '[data-tour="fin-tabs"]',
        title: "Abas",
        body: "Visão geral, Contas a receber, Contas a pagar, Inadimplência e DRE gerencial. Em Contas a receber há subfiltros (a vencer / vencidas / pagas).",
      },
    ],
  },

  // Integrações (Meta / Google).
  {
    id: "integracoes",
    title: "Integrações",
    match: /^\/gerencial\/integracoes/,
    steps: [
      {
        selector: '[data-tour="page-header"]',
        title: "Integrações",
        body: "Conecte as contas externas: a Google Agenda da agência e o Instagram/Facebook de cada cliente via Meta.",
      },
      {
        selector: '[data-tour="int-google"]',
        title: "Google Agenda",
        body: "Conecte (ou reconecte) a agenda do Google para sincronizar reuniões. Abaixo há um guia de ativação quando ainda não está configurada.",
      },
      {
        title: "Meta por cliente",
        body: "Na lista de clientes, cada card tem 'Conectar/Reconectar' e o botão de sincronizar — é o que puxa as métricas de mídia e orgânico.",
      },
    ],
  },

  // Agenda.
  {
    id: "agenda",
    title: "Agenda",
    match: /^\/gerencial\/agenda/,
    steps: [
      {
        selector: '[data-tour="page-header"]',
        title: "Agenda",
        body: "Sua gestora de tempo: rotina, reuniões e tarefas do CRM num calendário só.",
      },
      {
        selector: '[data-tour="agenda-view"]',
        title: "Dia / Semana / Mês",
        body: "Troca a visão do calendário. Ao lado ficam 'Hoje' e as setas de navegação.",
      },
      {
        title: "Criar e organizar",
        body: "'Reunião' cria um evento; 'Configurar rotina' monta seus blocos fixos; 'Links de agendamento' gera links para o cliente marcar. À direita, as tarefas de hoje.",
      },
    ],
  },

  // Fallback: noções básicas do painel — vale para qualquer tela autenticada.
  {
    id: "app-basics",
    title: "Conhecendo o painel",
    match: /^\/(gerencial|cliente)(\/|$)/,
    steps: [
      {
        title: "Bem-vindo ao Painel Viofilme 👋",
        body: "Um tour rápido pelos elementos que aparecem em todas as telas. Use o botão '?' no topo a qualquer momento para rever o tutorial da tela em que estiver.",
      },
      {
        selector: '[data-tour="sidebar"]',
        title: "Menu lateral",
        body: "Todas as áreas do painel. Ele vem recolhido por padrão — passe o mouse ou fixe. Atalho ⌘B / Ctrl+B recolhe e expande.",
      },
      {
        selector: '[data-tour="search"]',
        title: "Busca rápida",
        body: "Encontre clientes, telas e ações rapidamente. Atalho ⌘K / Ctrl+K de qualquer lugar.",
      },
      {
        selector: '[data-tour="tutorial-btn"]',
        title: "Botão de tutorial",
        body: "Este '?' reabre o tutorial da tela atual sempre que você quiser. Cada página tem o seu.",
      },
      {
        selector: '[data-tour="assistant"]',
        title: "Assistente Cadu",
        body: "Seu assistente de IA. Ele conhece os dados dos clientes e o funcionamento do painel — pergunte 'como faço X' que ele explica o caminho.",
      },
    ],
  },
];

/** Retorna o tour da rota (primeiro match) ou null. */
export function findTour(pathname: string): Tour | null {
  return TOURS.find((t) => t.match.test(pathname)) ?? null;
}
