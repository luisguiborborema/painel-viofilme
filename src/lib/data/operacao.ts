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
