/**
 * Módulo 3 — Operação & Produção (dados mock).
 *
 * Vertical 1 (Hub de Clientes), 2 (Painel de Entregas) e 3 (Central de
 * Relatórios). Mock-first: a UI usa estes dados; as migrations equivalentes
 * serão ligadas ao Supabase depois.
 */
import { CS_CLIENTS } from "./cs";

export type HubPlan = "Tráfego + Social" | "Social Pro" | "Full Service";
export type HubStatus = "ativo" | "onboarding";

export type HubClient = {
  id: string;
  name: string;
  segment: string;
  city: string;
  plan: HubPlan;
  status: HubStatus;
  atRisk: boolean;
  healthScore: number;
  nps: number;
  responsavel: string;
  mrr: number;
  /** Progresso do VioLaunch (onboarding), quando aplicável. */
  onboarding?: { step: number; total: number; startDate: string };
};

const PLAN: Record<string, HubPlan> = {
  "cli-001": "Social Pro",
  "cli-adv": "Social Pro",
  "cli-imob": "Tráfego + Social",
  "cli-farm": "Full Service",
  "cli-studio": "Social Pro",
  "cli-odonto": "Full Service",
  "cli-fit": "Tráfego + Social",
  "cli-moda": "Social Pro",
};

const ONBOARDING: Record<
  string,
  { step: number; total: number; startDate: string }
> = {
  "cli-imob": { step: 4, total: 8, startDate: "01/07" },
  "cli-studio": { step: 6, total: 8, startDate: "20/06" },
};

export function getHubClients(): HubClient[] {
  return CS_CLIENTS.map((c) => {
    const onboarding = ONBOARDING[c.id];
    return {
      id: c.id,
      name: c.name,
      segment: c.segment,
      city: c.city,
      plan: PLAN[c.id] ?? "Social Pro",
      status: onboarding ? "onboarding" : "ativo",
      atRisk: c.atRisk,
      healthScore: c.healthScore,
      nps: c.nps,
      responsavel: c.cs,
      mrr: c.mrr,
      onboarding,
    };
  });
}

export const HUB_PLANS: HubPlan[] = [
  "Tráfego + Social",
  "Social Pro",
  "Full Service",
];

// --- VioLaunch (onboarding) --------------------------------------------------
const VIOLAUNCH_STEPS = [
  "Contrato assinado",
  "Acessos & integrações",
  "Briefing estratégico",
  "Planejamento inicial",
  "Setup de tráfego",
  "Primeira linha editorial",
  "Kickoff com o cliente",
  "Primeira entrega",
];

export function getVioLaunch(clientId: string) {
  const c = getHubClients().find((x) => x.id === clientId);
  const total = VIOLAUNCH_STEPS.length;
  const done = c?.onboarding?.step ?? total; // ativos = onboarding concluído
  return {
    step: done,
    total,
    startDate: c?.onboarding?.startDate ?? "—",
    steps: VIOLAUNCH_STEPS.map((label, i) => ({ label, done: i < done })),
  };
}

// --- Documentos do cliente ---------------------------------------------------
export type ClientDoc = { id: string; title: string; meta: string; kind: string };

export function getClientDocuments(_clientId: string): ClientDoc[] {
  return [
    { id: "d1", title: "Contrato de prestação de serviços", meta: "PDF · 340 KB", kind: "contrato" },
    { id: "d2", title: "Briefing estratégico", meta: "PDF · 120 KB", kind: "briefing" },
    { id: "d3", title: "Manual de marca", meta: "PDF · 2,1 MB", kind: "marca" },
    { id: "d4", title: "Apresentação de resultados — mês anterior", meta: "PDF · 880 KB", kind: "relatorio" },
  ];
}

// --- Criativos de performance ------------------------------------------------
export type ClientCreative = {
  id: string;
  title: string;
  format: "Reels" | "Feed" | "Stories" | "Carrossel";
  reach: number;
  ctr: number;
  spend: number;
};

export function getClientCreatives(_clientId: string): ClientCreative[] {
  return [
    { id: "c1", title: "Reels — bastidores da cozinha", format: "Reels", reach: 31200, ctr: 2.4, spend: 480 },
    { id: "c2", title: "Carrossel — novo menu", format: "Carrossel", reach: 15800, ctr: 1.9, spend: 360 },
    { id: "c3", title: "Feed — moqueca da casa", format: "Feed", reach: 9800, ctr: 1.5, spend: 220 },
    { id: "c4", title: "Stories — enquete do dia", format: "Stories", reach: 4200, ctr: 3.1, spend: 90 },
  ];
}

// --- Linha Editorial (V1c) ---------------------------------------------------
export type EditorialStage =
  | "ideacao"
  | "pautas"
  | "aprovacao"
  | "tarefas"
  | "producao"
  | "concluida";

export const EDITORIAL_STAGES: { key: EditorialStage; label: string }[] = [
  { key: "ideacao", label: "Ideação" },
  { key: "pautas", label: "Pautas definidas" },
  { key: "aprovacao", label: "Aprovação cliente" },
  { key: "tarefas", label: "Geração de tarefas" },
  { key: "producao", label: "Em produção" },
  { key: "concluida", label: "Concluída" },
];

export type EditorialFormat = "Feed" | "Reels" | "Stories" | "Carrossel";

export type EditorialPost = {
  n: number;
  date: string; // "01/07"
  weekday: string; // "seg"
  title: string;
  format: EditorialFormat;
  pillar: string;
  description: string;
  assetNote: string;
};

export type EditorialPillar = { name: string; posts: number; color: string };

export type EditorialLine = {
  clientName: string;
  month: string;
  createdBy: string;
  stage: EditorialStage;
  frequency: string;
  networks: string;
  responsibles: string;
  approvalMeeting: string;
  pillars: EditorialPillar[];
  posts: EditorialPost[];
};

// --- Central de Relatórios (V3) ---------------------------------------------
export type ReportSummary = {
  organic: {
    seguidores: number;
    alcance: number;
    engajamento: number;
    impressoes: number;
    comentarios: number;
    salvamentos: number;
  };
  paid: {
    investimento: number;
    leads: number;
    cpl: number;
    conversoes: number;
    cliques: number;
    cpa: number;
  };
};

/** Resumo determinístico por cliente (mock-first; futuro: dados reais das APIs). */
export function getReportSummary(clientId: string): ReportSummary {
  const c = getHubClients().find((x) => x.id === clientId);
  const h = c?.healthScore ?? 60;
  const m = c?.mrr ?? 2500;
  const invest = Math.round(m * 0.85);
  const leads = Math.round(h * 1.6);
  const conv = Math.round(leads * 0.22);
  const clicks = Math.round(leads * 7.5);
  return {
    organic: {
      seguidores: Math.round(h * 4),
      alcance: Math.round(m * 6.5),
      engajamento: Math.round((h / 18) * 10) / 10,
      impressoes: Math.round(m * 18),
      comentarios: Math.round(h * 1.2),
      salvamentos: Math.round(h * 2.1),
    },
    paid: {
      investimento: invest,
      leads,
      cpl: Math.round((invest / Math.max(1, leads)) * 100) / 100,
      conversoes: conv,
      cliques: clicks,
      cpa: Math.round((invest / Math.max(1, conv)) * 100) / 100,
    },
  };
}

export const REPORT_ORGANIC_METRICS = [
  { key: "seguidores", label: "Crescimento de seguidores" },
  { key: "alcance", label: "Alcance total" },
  { key: "engajamento", label: "Taxa de engajamento" },
  { key: "comentarios", label: "Comentários" },
  { key: "salvamentos", label: "Salvamentos" },
  { key: "impressoes", label: "Impressões" },
] as const;

export const REPORT_PAID_METRICS = [
  { key: "investimento", label: "Investimento total" },
  { key: "leads", label: "Leads gerados" },
  { key: "cpl", label: "CPL (custo por lead)" },
  { key: "conversoes", label: "Conversões reais" },
  { key: "cliques", label: "Cliques totais" },
  { key: "cpa", label: "CPA" },
] as const;

export type IntegrationStatus = {
  name: string;
  status: "ok" | "warn";
  note?: string;
};

export const REPORT_INTEGRATIONS: IntegrationStatus[] = [
  { name: "Meta Ads", status: "ok", note: "Conectado" },
  { name: "Google Ads", status: "ok", note: "Conectado" },
  { name: "Instagram Business", status: "ok", note: "Conectado" },
  { name: "Google Analytics 4", status: "warn", note: "Token expirado" },
];

export type ReportHistoryItem = {
  id: string;
  client: string;
  period: string;
  kind: string;
};

export function getReportHistory(): ReportHistoryItem[] {
  return [
    { id: "r1", client: "Restaurante Sabor do Mar", period: "Mai/25", kind: "PDF" },
    { id: "r2", client: "Rede Farmácia BH", period: "Mai/25", kind: "PDF" },
    { id: "r3", client: "Advocacia Menezes & Assis", period: "Abr/25", kind: "PDF" },
  ];
}

// --- Painel de Entregas (V2) -------------------------------------------------
export const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex"];

export type OpsMember = {
  id: string;
  name: string;
  initials: string;
  role: string;
  capacityH: number; // por dia
};

export const OPS_TEAM: OpsMember[] = [
  { id: "robert", name: "Robert", initials: "RB", role: "Design", capacityH: 8 },
  { id: "ana", name: "Ana Lima", initials: "AL", role: "Social Media", capacityH: 8 },
  { id: "gustavo", name: "Gustavo", initials: "GU", role: "Copy", capacityH: 8 },
  { id: "mariana", name: "Mariana", initials: "MA", role: "Tráfego", capacityH: 8 },
  { id: "lucas", name: "Lucas", initials: "LU", role: "Design", capacityH: 8 },
];

export type TaskStage = "todo" | "doing" | "review" | "approval" | "done";
export type TaskType = "Arte" | "Vídeo" | "Copy" | "Tráfego";
export type TaskOrigin = "Linha editorial" | "Projeto" | "Tarefa avulsa";

export const TASK_STAGES: { key: TaskStage; label: string }[] = [
  { key: "todo", label: "Para fazer" },
  { key: "doing", label: "Em andamento" },
  { key: "review", label: "Revisão interna" },
  { key: "approval", label: "Aprovação cliente" },
  { key: "done", label: "Concluído" },
];

export type DeliveryTask = {
  id: string;
  title: string;
  client: string;
  type: TaskType;
  origin: TaskOrigin;
  assignee: string; // OpsMember id
  stage: TaskStage;
  dueLabel: string;
  late: boolean;
  estimateH: number;
  loggedH: number;
  day: number; // dia de entrega (0=Seg..4=Sex)
  startDay: number; // início (Gantt)
  span: number; // duração em dias (Gantt)
};

export function getDeliveryTasks(): DeliveryTask[] {
  return [
    { id: "tk1", title: "Arte carrossel 5 slides — saúde bucal", client: "Clínica Odonto Plus", type: "Arte", origin: "Linha editorial", assignee: "robert", stage: "todo", dueLabel: "Atrasada 2 dias", late: true, estimateH: 4, loggedH: 0, day: 1, startDay: 1, span: 1 },
    { id: "tk2", title: "Arte post feed — menu degustação", client: "Rest. Sabor do Mar", type: "Arte", origin: "Linha editorial", assignee: "robert", stage: "doing", dueLabel: "Hoje · 19h", late: false, estimateH: 3, loggedH: 1.5, day: 2, startDay: 1, span: 2 },
    { id: "tk3", title: "Thumb Reels — bastidores cozinha", client: "Rest. Sabor do Mar", type: "Arte", origin: "Linha editorial", assignee: "lucas", stage: "doing", dueLabel: "Hoje · 12h", late: false, estimateH: 1.5, loggedH: 1, day: 2, startDay: 2, span: 1 },
    { id: "tk4", title: "Reels aniversário 1 ano", client: "Rest. Sabor do Mar", type: "Vídeo", origin: "Projeto", assignee: "lucas", stage: "review", dueLabel: "Revisão: Ana Lima", late: false, estimateH: 6, loggedH: 5, day: 3, startDay: 1, span: 3 },
    { id: "tk5", title: "Copy 5 stories institucionais", client: "Advocacia Menezes", type: "Copy", origin: "Linha editorial", assignee: "gustavo", stage: "doing", dueLabel: "Prazo: 26/06", late: false, estimateH: 1.5, loggedH: 0.5, day: 4, startDay: 3, span: 1 },
    { id: "tk6", title: "Identidade visual — versão final", client: "Advocacia Menezes", type: "Arte", origin: "Projeto", assignee: "robert", stage: "todo", dueLabel: "Prazo: 27/06", late: false, estimateH: 6, loggedH: 0, day: 4, startDay: 3, span: 2 },
    { id: "tk7", title: "Post feed menu — pub. hoje", client: "Rest. Sabor do Mar", type: "Arte", origin: "Linha editorial", assignee: "lucas", stage: "approval", dueLabel: "Aguarda 2d", late: false, estimateH: 2, loggedH: 2, day: 2, startDay: 0, span: 1 },
    { id: "tk8", title: "Post promoção aniversário", client: "Rede Farmácia BH", type: "Arte", origin: "Linha editorial", assignee: "robert", stage: "approval", dueLabel: "Aguarda 3d · urgente", late: false, estimateH: 2, loggedH: 2, day: 3, startDay: 1, span: 1 },
    { id: "tk9", title: "Campanha tráfego — reservas", client: "Rest. Sabor do Mar", type: "Tráfego", origin: "Projeto", assignee: "mariana", stage: "doing", dueLabel: "Esta semana", late: false, estimateH: 3, loggedH: 1, day: 2, startDay: 0, span: 4 },
    { id: "tk10", title: "Roteiro Reels — peixe do dia", client: "Rest. Sabor do Mar", type: "Copy", origin: "Linha editorial", assignee: "gustavo", stage: "todo", dueLabel: "Prazo: 25/06", late: false, estimateH: 1.5, loggedH: 0, day: 0, startDay: 0, span: 1 },
    { id: "tk11", title: "Legendas pacote julho", client: "Rede Farmácia BH", type: "Copy", origin: "Linha editorial", assignee: "gustavo", stage: "review", dueLabel: "Revisão: Ana Lima", late: false, estimateH: 2, loggedH: 1.5, day: 3, startDay: 2, span: 2 },
    { id: "tk12", title: "Arte stories — enquete semanal", client: "Clínica Odonto Plus", type: "Arte", origin: "Linha editorial", assignee: "lucas", stage: "todo", dueLabel: "Prazo: 28/06", late: false, estimateH: 1, loggedH: 0, day: 4, startDay: 4, span: 1 },
    { id: "tk13", title: "Relatório mensal — apresentação", client: "Rede Farmácia BH", type: "Tráfego", origin: "Tarefa avulsa", assignee: "mariana", stage: "todo", dueLabel: "Prazo: 30/06", late: false, estimateH: 2, loggedH: 0, day: 4, startDay: 3, span: 2 },
    { id: "tk14", title: "Aprovação calendário julho", client: "Advocacia Menezes", type: "Copy", origin: "Linha editorial", assignee: "ana", stage: "approval", dueLabel: "Aguarda cliente", late: false, estimateH: 1, loggedH: 1, day: 1, startDay: 1, span: 1 },
  ];
}

export function getEditorialLine(clientId: string): EditorialLine {
  const client = getHubClients().find((c) => c.id === clientId);
  return {
    clientName: client?.name ?? "Cliente",
    month: "Julho / 2025",
    createdBy: "Ana Lima · Social Media",
    stage: "aprovacao",
    frequency: "5 posts/semana · 22 ativos",
    networks: "Instagram · Facebook",
    responsibles: "Ana Lima (SM) + Robert (Design)",
    approvalMeeting: "26/06 às 10h · hoje",
    pillars: [
      { name: "Bastidores & autenticidade", posts: 6, color: "#f59e0b" },
      { name: "Cardápio & produto", posts: 7, color: "#34d399" },
      { name: "Experiência & reservas", posts: 5, color: "#38bdf8" },
      { name: "Educação & contexto", posts: 4, color: "#a855f7" },
    ],
    posts: [
      { n: 1, date: "01/07", weekday: "seg", title: "Abertura do mês: boas-vindas a julho com o novo cardápio", format: "Feed", pillar: "Cardápio & produto", description: "Post estático. Legenda celebratória apresentando as novidades do mês.", assetNote: "Foto estúdio" },
      { n: 2, date: "03/07", weekday: "qua", title: "Reels: o chef revela o segredo do camarão", format: "Reels", pillar: "Bastidores & autenticidade", description: "Vídeo de bastidores. Corte rápido, narração do chef.", assetNote: "Gravar no Media Day · 28/06" },
      { n: 3, date: "04/07", weekday: "qui", title: "Stories: enquete — qual prato pedir essa semana?", format: "Stories", pillar: "Experiência & reservas", description: "Sequência interativa com 4 opções. Responder nos stories seguintes.", assetNote: "Template Stories" },
      { n: 4, date: "07/07", weekday: "seg", title: "Carrossel: 5 motivos para experimentar a degustação", format: "Carrossel", pillar: "Cardápio & produto", description: "5 cards. Capa impactante, slides 2 a 5 com cada motivo.", assetNote: "6 artes separadas" },
      { n: 5, date: "09/07", weekday: "qua", title: "Peixe do dia & a seleção semanal direta do mercado", format: "Feed", pillar: "Educação & contexto", description: "Foto do peixe no estoque. Legenda informativa sobre procedência.", assetNote: "Foto cliente ou stock" },
      { n: 6, date: "11/07", weekday: "sex", title: "Reels: harmonização do menu degustação com vinhos", format: "Reels", pillar: "Cardápio & produto", description: "Sommelier explica os pares. Ritmo calmo, foco no produto.", assetNote: "Gravar no Media Day · 28/06" },
      { n: 7, date: "14/07", weekday: "seg", title: "Depoimento real de cliente sobre a experiência", format: "Feed", pillar: "Experiência & reservas", description: "Print/foto do cliente com a citação em destaque.", assetNote: "Coletar autorização" },
      { n: 8, date: "16/07", weekday: "qua", title: "Bastidores: a chegada dos ingredientes frescos", format: "Stories", pillar: "Bastidores & autenticidade", description: "Sequência curta mostrando o recebimento da manhã.", assetNote: "Gravar no dia" },
    ],
  };
}
