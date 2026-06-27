/**
 * Dicionário central de métricas — usado pelo pop-up "i" (CAM05/ORG04) e pelo
 * modal "Entender os números" (CAM07). Linguagem simples para o cliente.
 */
export type GlossaryEntry = {
  name: string;
  description: string;
  /** true quando menor é melhor (métricas de custo). */
  goodIsLow?: boolean;
  scaleLow: string;
  scaleHigh: string;
  tip: string;
};

export const METRIC_GLOSSARY: Record<string, GlossaryEntry> = {
  investimento: {
    name: "Investimento total",
    description: "Quanto foi investido em anúncios no período.",
    scaleLow: "Pouco",
    scaleHigh: "Muito",
    tip: "Não é bom nem ruim sozinho — vale junto com leads e CPL.",
  },
  leads: {
    name: "Leads gerados",
    description: "Pessoas que demonstraram interesse (formulário, clique, contato).",
    scaleLow: "Poucos",
    scaleHigh: "Muitos",
    tip: "Quanto mais leads pelo mesmo valor, melhor.",
  },
  cpl: {
    name: "Custo por lead (CPL)",
    description: "Quanto custou, em média, cada lead gerado.",
    goodIsLow: true,
    scaleLow: "Baixo = ótimo",
    scaleHigh: "Alto = caro",
    tip: "Quanto menor, mais eficiente está o investimento.",
  },
  conversoes: {
    name: "Conversões reais",
    description: "Ações concluídas que importam para o negócio (venda, reserva, agendamento).",
    scaleLow: "Poucas",
    scaleHigh: "Muitas",
    tip: "É o resultado final que conta — leads que viraram clientes.",
  },
  cliques: {
    name: "Total de cliques",
    description: "Quantas vezes as pessoas clicaram nos anúncios.",
    scaleLow: "Poucos",
    scaleHigh: "Muitos",
    tip: "Mostra interesse, mas só vale se virar lead ou conversão.",
  },
  cpc: {
    name: "Custo por clique (CPC)",
    description: "Quanto custou, em média, cada clique no anúncio.",
    goodIsLow: true,
    scaleLow: "Baixo = ótimo",
    scaleHigh: "Alto = caro",
    tip: "CPC baixo com bom CPL indica anúncio e público bem alinhados.",
  },
  cpa: {
    name: "Custo por aquisição (CPA)",
    description: "Quanto custou, em média, cada conversão real.",
    goodIsLow: true,
    scaleLow: "Baixo = ótimo",
    scaleHigh: "Alto = caro",
    tip: "É o custo do que realmente importa: o cliente final.",
  },
  roas: {
    name: "ROAS",
    description: "Retorno sobre o investimento em anúncios (receita ÷ investido).",
    scaleLow: "Baixo",
    scaleHigh: "Alto = ótimo",
    tip: "ROAS 4 significa R$ 4 de receita para cada R$ 1 investido.",
  },
  seguidores: {
    name: "Seguidores totais",
    description: "Tamanho atual da sua comunidade nas redes.",
    scaleLow: "Menos",
    scaleHigh: "Mais",
    tip: "Crescimento constante vale mais que picos isolados.",
  },
  alcance: {
    name: "Alcance no mês",
    description: "Pessoas únicas que viram seu conteúdo.",
    scaleLow: "Menor",
    scaleHigh: "Maior",
    tip: "Mede quantas pessoas diferentes foram impactadas.",
  },
  impressoes: {
    name: "Impressões",
    description: "Quantas vezes seu conteúdo apareceu (a mesma pessoa conta mais de uma vez).",
    scaleLow: "Menos",
    scaleHigh: "Mais",
    tip: "Impressões altas com alcance menor = boa frequência.",
  },
  engajamento: {
    name: "Taxa de engajamento",
    description: "Quanto a audiência interage (curtidas, comentários, salvamentos) em relação ao alcance.",
    scaleLow: "Baixa",
    scaleHigh: "Alta = ótimo",
    tip: "Acima de ~3% costuma ser um ótimo sinal.",
  },
  salvamentos: {
    name: "Salvamentos",
    description: "Quantas pessoas salvaram o conteúdo para ver depois.",
    scaleLow: "Poucos",
    scaleHigh: "Muitos",
    tip: "Salvamento é um dos sinais mais fortes de conteúdo útil.",
  },
  comentarios: {
    name: "Comentários",
    description: "Interações em comentários nas publicações.",
    scaleLow: "Poucos",
    scaleHigh: "Muitos",
    tip: "Conteúdo que gera conversa tende a alcançar mais gente.",
  },
  compartilhamentos: {
    name: "Compartilhamentos",
    description: "Quantas vezes seu conteúdo foi compartilhado.",
    scaleLow: "Poucos",
    scaleHigh: "Muitos",
    tip: "Compartilhar é a recomendação mais valiosa da audiência.",
  },
  views: {
    name: "Views de vídeo",
    description: "Visualizações dos seus vídeos e Reels.",
    scaleLow: "Menos",
    scaleHigh: "Mais",
    tip: "Combine com retenção para entender se prendem a atenção.",
  },
};
