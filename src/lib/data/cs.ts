import type {
  CSClient,
  CSClientDetail,
  CSPortfolio,
  CSTimelineEvent,
} from "./types";

const ok = { label: "Em dia", tone: "ok" as const };

export const CS_CLIENTS: CSClient[] = [
  {
    id: "cli-001",
    name: "Restaurante Sabor do Mar",
    segment: "Gastronomia",
    city: "Vitória, ES",
    mrr: 2800,
    healthScore: 84,
    nps: 9,
    financial: ok,
    contract: { label: "Ativo", tone: "ok" },
    cs: "Ana Lima",
    lastContactDays: 3,
    atRisk: false,
    healthy: true,
    renewingSoon: false,
  },
  {
    id: "cli-adv",
    name: "Advocacia Menezes & Assis",
    segment: "Jurídico",
    city: "Vitória, ES",
    mrr: 4400,
    healthScore: 78,
    nps: 8,
    financial: ok,
    contract: { label: "Renova em 32d", tone: "warn" },
    cs: "Ana Lima",
    lastContactDays: 7,
    atRisk: false,
    healthy: true,
    renewingSoon: true,
  },
  {
    id: "cli-imob",
    name: "Imobiliária Costa Mar",
    segment: "Imóveis",
    city: "Vila Velha, ES",
    mrr: 2200,
    healthScore: 62,
    nps: 7,
    financial: ok,
    contract: { label: "Ativo", tone: "ok" },
    cs: "Mariana Az.",
    lastContactDays: 14,
    atRisk: false,
    healthy: true,
    renewingSoon: false,
  },
  {
    id: "cli-farm",
    name: "Rede Farmácia BH",
    segment: "Varejo",
    city: "Belo Horizonte, MG",
    mrr: 6500,
    healthScore: 88,
    nps: 10,
    financial: ok,
    contract: { label: "Renova em 18d", tone: "warn" },
    cs: "Mariana Az.",
    lastContactDays: 0,
    atRisk: false,
    healthy: true,
    renewingSoon: true,
  },
  {
    id: "cli-studio",
    name: "Studio Bela Forma",
    segment: "Beleza",
    city: "Serra, ES",
    mrr: 2400,
    healthScore: 71,
    nps: 8,
    financial: ok,
    contract: { label: "Renova em 45d", tone: "warn" },
    cs: "Ana Lima",
    lastContactDays: 5,
    atRisk: false,
    healthy: true,
    renewingSoon: true,
  },
  {
    id: "cli-odonto",
    name: "Clínica Odonto Plus",
    segment: "Saúde",
    city: "Vitória, ES",
    mrr: 3500,
    healthScore: 66,
    nps: 8,
    financial: { label: "Vence em 5d", tone: "warn" },
    contract: { label: "Ativo", tone: "ok" },
    cs: "Mariana Az.",
    lastContactDays: 9,
    atRisk: false,
    healthy: false,
    renewingSoon: false,
  },
  {
    id: "cli-fit",
    name: "Academia FitBody",
    segment: "Fitness",
    city: "Vila Velha, ES",
    mrr: 2800,
    healthScore: 32,
    nps: 4,
    financial: { label: "Vencida 12d", tone: "danger" },
    contract: { label: "Ativo", tone: "ok" },
    cs: "Ana Lima",
    lastContactDays: 21,
    atRisk: true,
    healthy: false,
    renewingSoon: false,
  },
  {
    id: "cli-moda",
    name: "Loja ModaVerde",
    segment: "Varejo",
    city: "Vitória, ES",
    mrr: 2800,
    healthScore: 28,
    nps: 5,
    financial: ok,
    contract: { label: "Ativo", tone: "ok" },
    cs: "Mariana Az.",
    lastContactDays: 18,
    atRisk: true,
    healthy: false,
    renewingSoon: false,
  },
];

export function getCSPortfolio(): CSPortfolio {
  const clients = CS_CLIENTS;
  return {
    periodLabel: `${clients.length} contas ativas · junho 2026`,
    npsAvg: 72,
    promoters: 5,
    neutrals: 2,
    detractors: 1,
    churnRisk: clients.filter((c) => c.atRisk).length,
    renewals: clients.filter((c) => c.renewingSoon).length,
    renewalsValue: 10200,
    retentionRate: 91,
    churnNote: "1 churn em 2026 (jan)",
    mrrTotal: 31000,
    alertText:
      "Academia FitBody (NPS 4, fatura vencida) · Loja ModaVerde (NPS 5, 3 ajustes consecutivos) — intervenção recomendada hoje",
    clients,
  };
}

const RESTAURANTE_TIMELINE: CSTimelineEvent[] = [
  { id: "t1", date: "09/06", text: "NPS respondido: nota 9 — “Atendimento ágil e criativo”", kind: "nps" },
  { id: "t2", date: "02/06", text: "Reunião de resultados realizada — alinhamento de junho", kind: "meeting" },
  { id: "t3", date: "28/05", text: "Reembolso pago por atraso de publicação (cortesia)", kind: "refund" },
  { id: "t4", date: "05/06", text: "Pagamento Jun/2026 confirmado via PIX", kind: "payment" },
  { id: "t5", date: "15/01", text: "Onboarding concluído — contrato assinado", kind: "onboarding" },
];

const BRIEFING_RESTAURANTE = {
  objetivo:
    "Aumentar reservas e visibilidade local, com foco em Instagram e Google.",
  tomDeVoz:
    "Sofisticado mas acolhedor. Destaca o frescor dos frutos do mar e a experiência gastronômica.",
  publico:
    "Casais 30–60 anos, classe média-alta, profissionais em almoços executivos.",
  concorrentes: "Restaurante Canto do Mar, Marisqueira Atlântico.",
  restricoes:
    "Evitar promoções agressivas de preço. Fotos reais do restaurante e pratos.",
};

const GENERIC_BRIEFING = {
  objetivo: "Crescimento de leads qualificados e fortalecimento da marca.",
  tomDeVoz: "Profissional, próximo e confiável.",
  publico: "Público local da região, faixa adulta economicamente ativa.",
  concorrentes: "Principais players locais do segmento.",
  restricoes: "Seguir o manual de marca e aprovar peças antes de publicar.",
};

export function getCSClientDetail(id: string): CSClientDetail | null {
  const client = CS_CLIENTS.find((c) => c.id === id);
  if (!client) return null;

  const isRestaurante = client.id === "cli-001";

  const timeline: CSTimelineEvent[] = isRestaurante
    ? RESTAURANTE_TIMELINE
    : [
        { id: "g1", date: "05/06", text: "Pagamento Jun/2026 confirmado", kind: "payment" },
        { id: "g2", date: "31/05", text: "Reunião mensal de resultados realizada", kind: "meeting" },
        { id: "g3", date: "20/05", text: `NPS respondido: nota ${client.nps}`, kind: "nps" },
        { id: "g4", date: "10/02", text: "Onboarding concluído", kind: "onboarding" },
      ];

  const npsClassification =
    client.nps >= 9 ? "Promotor" : client.nps >= 7 ? "Neutro" : "Detrator";

  return {
    client,
    contactName: isRestaurante ? "Pedro Costa" : "Responsável da conta",
    contactRole: isRestaurante ? "CEO" : "Diretoria",
    phone: isRestaurante ? "(27) 99123-4567" : "(27) 99000-0000",
    email: isRestaurante
      ? "pedro@sabordomar.com.br"
      : `contato@${client.id}.com.br`,
    clientSince: isRestaurante ? "09/01/2026" : "10/02/2026",
    plan: isRestaurante ? "Social Pro" : "Essencial",
    tenure: isRestaurante ? "5 meses" : "4 meses",
    ltv: client.mrr * 12,
    invoicesNote: client.financial.tone === "ok" ? "Faturas em dia" : client.financial.label,
    npsClassification,
    npsLastSurvey: "09/06/2026",
    npsQuote: isRestaurante
      ? "“Atendimento ágil e criativo. As campanhas trouxeram mais reservas no fim de semana.”"
      : "Sem comentário registrado na última pesquisa.",
    timeline,
    nextMeeting: {
      title: "Alinhamento mensal de resultados",
      whenLabel: "Quinta, 26 jun · 10h00",
    },
    nextContact: "Próximo contato programado: reunião mensal · Google Meet",
    briefing: isRestaurante ? BRIEFING_RESTAURANTE : GENERIC_BRIEFING,
    campaigns: isRestaurante
      ? [
          { name: "Reservas fim de semana", cpl: 8.38, tone: "ok" },
          { name: "Busca frutos do mar Vitória", cpl: 7.5, tone: "ok" },
        ]
      : [
          { name: "Campanha local", cpl: 9.2, tone: "warn" },
          { name: "Busca institucional", cpl: 7.8, tone: "ok" },
        ],
    campaignsInvested: isRestaurante ? 2160 : Math.round(client.mrr * 0.7),
  };
}
