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
