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
