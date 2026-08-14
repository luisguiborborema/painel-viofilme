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
    match: /^\/gerencial\/comercial(\/pipeline)?(\/|$)/,
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
