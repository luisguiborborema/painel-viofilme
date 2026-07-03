/**
 * Módulo 2 — CRM & Vendas (funil de aquisição).
 *
 * Client-safe: só tipos, dados mock e helpers PUROS (sem imports de servidor).
 * As leituras reais do Supabase ficam em `supabase.ts` (sbCrm*) e a delegação
 * dual-mode em `queries.ts` (getCrm*). As escritas ficam em /api/crm/*.
 */
import { REFERENCE_DATE } from "./mock";

// ── Tipos base ──────────────────────────────────────────────────────────────

export type CrmStage =
  | "prospeccao"
  | "reuniao"
  | "proposta"
  | "negociacao"
  | "ganho"
  | "perdido";

export type CrmChannel = "whatsapp" | "email" | "call" | "note" | "system";

export type Bant = {
  budget?: string;
  authority?: string;
  need?: string;
  timing?: string;
};

export type CrmLead = {
  id: string;
  name: string;
  contactName?: string;
  contactPhone?: string; // dígitos DDI+DDD
  contactEmail?: string;
  segment?: string;
  stage: CrmStage;
  monthlyValue: number;
  mediaBudget: number;
  plan?: string;
  probability: number; // 0..100
  source?: string;
  owner?: string;
  bant: Bant;
  nextTaskTitle?: string;
  nextTaskDue?: string;
  lastInteractionAt?: string;
  stageChangedAt: string;
  wonAt?: string;
  lostAt?: string;
  lostReason?: string;
  convertedClientId?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmInteraction = {
  id: string;
  leadId: string;
  channel: CrmChannel;
  direction?: "in" | "out" | null;
  body: string;
  author?: string;
  meta?: Record<string, unknown>;
  createdAt: string;
};

export type CrmTask = {
  id: string;
  leadId: string;
  title: string;
  dueDate?: string;
  status: "pending" | "done";
  doneAt?: string;
  createdAt: string;
};

// ── Estágios do funil ───────────────────────────────────────────────────────

export const CRM_STAGES: { key: CrmStage; label: string; open: boolean }[] = [
  { key: "prospeccao", label: "Prospecção", open: true },
  { key: "reuniao", label: "Reunião marcada", open: true },
  { key: "proposta", label: "Proposta enviada", open: true },
  { key: "negociacao", label: "Em negociação", open: true },
  { key: "ganho", label: "Ganho", open: false },
  { key: "perdido", label: "Perdido", open: false },
];

export const OPEN_STAGES = CRM_STAGES.filter((s) => s.open).map((s) => s.key);

export function stageLabel(stage: CrmStage): string {
  return CRM_STAGES.find((s) => s.key === stage)?.label ?? stage;
}

export const BANT_LABELS: { key: keyof Bant; label: string; hint: string }[] = [
  { key: "budget", label: "Budget", hint: "Verba disponível / faixa de investimento" },
  { key: "authority", label: "Autoridade", hint: "Quem decide a contratação" },
  { key: "need", label: "Necessidade", hint: "Dor principal / objetivo" },
  { key: "timing", label: "Timing", hint: "Prazo para decidir/começar" },
];

// ── Helpers puros ───────────────────────────────────────────────────────────

const DAY = 86_400_000;

/** Dias inteiros entre duas datas ISO (fromIso → nowIso). */
export function daysBetween(fromIso: string, nowIso: string): number {
  return Math.floor((Date.parse(nowIso) - Date.parse(fromIso)) / DAY);
}

export type Rot = "fresh" | "warn" | "stale";

/** Nível de "apodrecimento" pelo tempo parado no estágio. */
export function rotLevel(daysInStage: number): Rot {
  if (daysInStage >= 7) return "stale";
  if (daysInStage >= 3) return "warn";
  return "fresh";
}

export type CrmLeadCard = CrmLead & { daysInStage: number; rot: Rot };

export function toCard(lead: CrmLead, nowIso: string): CrmLeadCard {
  const daysInStage = Math.max(0, daysBetween(lead.stageChangedAt, nowIso));
  return { ...lead, daysInStage, rot: rotLevel(daysInStage) };
}

export type FocusKind = "overdue" | "today" | "no-action";

export type FocusItem = {
  leadId: string;
  leadName: string;
  title: string;
  dueIso?: string;
  kind: FocusKind;
  daysLate?: number;
};

export type StageBucket = { stage: CrmStage; label: string; count: number; value: number };

export type AgendaItem = { time: string; title: string; kind: "interno" | "lead" | "diretoria" };

export type BdrDashboard = {
  newMrr: number;
  wonCount: number;
  proposalsOpen: number;
  proposalsValue: number;
  winRate: number;
  avgTicket: number;
  meetingsPlanned: number;
  meetingsDone: number;
  pipelineOpenValue: number;
  pipelineWeighted: number;
  byStage: StageBucket[];
  focus: FocusItem[];
  score: number;
  scoreGoal: number;
};

function sameDay(aIso: string, bIso: string): boolean {
  const a = new Date(aIso);
  const b = new Date(bIso);
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** Monta a "Lista de Foco": atrasadas, do dia e leads sem próxima ação. */
export function buildFocus(
  leads: CrmLead[],
  tasks: CrmTask[],
  nowIso: string,
): FocusItem[] {
  const items: FocusItem[] = [];
  const leadName = (id: string) => leads.find((l) => l.id === id)?.name ?? "Lead";
  const openLeads = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const leadsWithTask = new Set<string>();

  for (const t of tasks) {
    if (t.status !== "pending" || !t.dueDate) continue;
    const lead = leads.find((l) => l.id === t.leadId);
    if (!lead || !OPEN_STAGES.includes(lead.stage)) continue;
    leadsWithTask.add(t.leadId);
    const late = daysBetween(t.dueDate, nowIso);
    if (Date.parse(t.dueDate) < Date.parse(nowIso) && !sameDay(t.dueDate, nowIso)) {
      items.push({ leadId: t.leadId, leadName: leadName(t.leadId), title: t.title, dueIso: t.dueDate, kind: "overdue", daysLate: Math.max(1, late) });
    } else if (sameDay(t.dueDate, nowIso)) {
      items.push({ leadId: t.leadId, leadName: leadName(t.leadId), title: t.title, dueIso: t.dueDate, kind: "today" });
    }
  }

  for (const l of openLeads) {
    if (!leadsWithTask.has(l.id)) {
      items.push({ leadId: l.id, leadName: l.name, title: "Sem próxima ação agendada", kind: "no-action" });
    }
  }

  const order: Record<FocusKind, number> = { overdue: 0, today: 1, "no-action": 2 };
  return items.sort((a, b) => order[a.kind] - order[b.kind] || (b.daysLate ?? 0) - (a.daysLate ?? 0));
}

/** Consolida os KPIs do dashboard BDR a partir de leads + tarefas. */
export function computeDashboard(
  leads: CrmLead[],
  tasks: CrmTask[],
  nowIso: string,
): BdrDashboard {
  const now = new Date(nowIso);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  const wonThisMonth = leads.filter((l) => l.wonAt && Date.parse(l.wonAt) >= Date.parse(monthStart));
  const lostThisMonth = leads.filter((l) => l.lostAt && Date.parse(l.lostAt) >= Date.parse(monthStart));
  const newMrr = wonThisMonth.reduce((s, l) => s + l.monthlyValue, 0);
  const closed = wonThisMonth.length + lostThisMonth.length;
  const winRate = closed ? Math.round((wonThisMonth.length / closed) * 100) : 0;
  const avgTicket = wonThisMonth.length ? Math.round(newMrr / wonThisMonth.length) : 0;

  const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const proposalsOpen = open.filter((l) => l.stage === "proposta" || l.stage === "negociacao");
  const pipelineOpenValue = open.reduce((s, l) => s + l.monthlyValue, 0);
  const pipelineWeighted = Math.round(
    open.reduce((s, l) => s + (l.monthlyValue * l.probability) / 100, 0),
  );

  const byStage: StageBucket[] = CRM_STAGES.filter((s) => s.open).map((s) => {
    const inStage = open.filter((l) => l.stage === s.key);
    return {
      stage: s.key,
      label: s.label,
      count: inStage.length,
      value: inStage.reduce((sum, l) => sum + l.monthlyValue, 0),
    };
  });

  const focus = buildFocus(leads, tasks, nowIso);

  return {
    newMrr,
    wonCount: wonThisMonth.length,
    proposalsOpen: proposalsOpen.length,
    proposalsValue: proposalsOpen.reduce((s, l) => s + l.monthlyValue, 0),
    winRate,
    avgTicket,
    meetingsPlanned: open.filter((l) => l.stage === "reuniao").length,
    meetingsDone: wonThisMonth.length + proposalsOpen.length,
    pipelineOpenValue,
    pipelineWeighted,
    byStage,
    focus,
    score: 720,
    scoreGoal: 1000,
  };
}

// ── Mock (fallback demo) ─────────────────────────────────────────────────────

const REF = REFERENCE_DATE.toISOString();
/** ISO com deslocamento de dias/horas a partir da data de referência. */
function iso(daysOffset: number, hour = 12): string {
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}

export const MOCK_LEADS: CrmLead[] = [
  {
    id: "lead-fitlife", name: "Academia FitLife", contactName: "Bruno Melo",
    contactPhone: "5527999990001", contactEmail: "bruno@fitlife.com.br",
    segment: "Saúde & Fitness", stage: "prospeccao", monthlyValue: 2800, mediaBudget: 1500,
    plan: "Social Pro", probability: 20, source: "Instagram Ads", owner: "Marcos Silva",
    bant: {}, stageChangedAt: iso(-8), lastInteractionAt: iso(-8),
    createdAt: iso(-8), updatedAt: iso(-8),
  },
  {
    id: "lead-odonto", name: "Clínica Odonto Plus", contactName: "Dra. Renata",
    contactPhone: "5527999990002", contactEmail: "renata@odontoplus.com.br",
    segment: "Saúde", stage: "prospeccao", monthlyValue: 3500, mediaBudget: 2000,
    plan: "Tráfego + Social", probability: 25, source: "Indicação", owner: "Ana Lima",
    bant: {}, stageChangedAt: iso(-2), lastInteractionAt: iso(-2),
    createdAt: iso(-2), updatedAt: iso(-2),
  },
  {
    id: "lead-bela", name: "Studio Bela Forma", contactName: "Camila Souza",
    contactPhone: "5527999990003", contactEmail: "camila@belaforma.com.br",
    segment: "Estética", stage: "reuniao", monthlyValue: 2400, mediaBudget: 1200,
    plan: "Social Pro", probability: 55, source: "Google Search", owner: "Marcos Silva",
    bant: { need: "Aumentar agendamentos" }, nextTaskTitle: "Reunião de descoberta",
    nextTaskDue: iso(1, 14), stageChangedAt: iso(-3), lastInteractionAt: iso(-1),
    createdAt: iso(-6), updatedAt: iso(-1),
  },
  {
    id: "lead-costamar", name: "Imobiliária Costa Mar", contactName: "Pedro Costa",
    contactPhone: "5527999924567", contactEmail: "pedro@costamar.com.br",
    segment: "Imóveis", stage: "proposta", monthlyValue: 5200, mediaBudget: 3000,
    plan: "Social Pro + Tráfego", probability: 80, source: "Indicação — Menezes & Assis",
    owner: "Ana Lima",
    bant: {
      budget: "R$ 5.000/mês (incluso mídia)", authority: "Pedro Costa (sócio-diretor)",
      need: "Leads qualificados para captação de imóveis",
    },
    nextTaskTitle: "Follow-up — confirmar data de início", nextTaskDue: iso(0, 15),
    lastInteractionAt: iso(0, 11), stageChangedAt: iso(-5),
    createdAt: iso(-12), updatedAt: iso(0, 11),
  },
  {
    id: "lead-vilamar", name: "Restaurante Vila Mar", contactName: "João Neto",
    contactPhone: "5527999990005", contactEmail: "joao@vilamar.com.br",
    segment: "Gastronomia", stage: "proposta", monthlyValue: 2800, mediaBudget: 1500,
    plan: "Social Pro", probability: 55, source: "Instagram", owner: "Marcos Silva",
    bant: { need: "Movimento no meio de semana" }, nextTaskTitle: "Retomar contato",
    nextTaskDue: iso(-2, 10), stageChangedAt: iso(-3), lastInteractionAt: iso(-3),
    createdAt: iso(-9), updatedAt: iso(-3),
  },
  {
    id: "lead-idiomas", name: "Escola de Idiomas Top", contactName: "Sara Lima",
    contactPhone: "5527999990006", contactEmail: "sara@idiomastop.com.br",
    segment: "Educação", stage: "proposta", monthlyValue: 2200, mediaBudget: 1000,
    plan: "Social Pro", probability: 40, source: "Facebook", owner: "Ana Lima",
    bant: {}, stageChangedAt: iso(-4), lastInteractionAt: iso(-4),
    createdAt: iso(-10), updatedAt: iso(-4),
  },
  {
    id: "lead-farmacias", name: "Rede de Farmácias BH", contactName: "Dr. Carlos A.",
    contactPhone: "5531999990007", contactEmail: "carlos@farmaciasbh.com.br",
    segment: "Varejo/Saúde", stage: "negociacao", monthlyValue: 8500, mediaBudget: 5000,
    plan: "Full Service", probability: 60, source: "Evento", owner: "Ana Lima",
    bant: { budget: "R$ 8.000+", authority: "Diretoria", need: "Presença regional" },
    nextTaskTitle: "Enviar contrato revisado", nextTaskDue: iso(2, 11),
    lastInteractionAt: iso(-1), stageChangedAt: iso(-4),
    createdAt: iso(-20), updatedAt: iso(-1),
  },
];

export const MOCK_INTERACTIONS: CrmInteraction[] = [
  { id: "int-1", leadId: "lead-costamar", channel: "system", body: "Lead criado — origem Indicação (Menezes & Assis).", createdAt: iso(-12, 9) },
  { id: "int-2", leadId: "lead-costamar", channel: "whatsapp", direction: "out", author: "Ana Lima", body: "Olá Pedro! Aqui é a Ana da Viofilme. Podemos marcar 20 min para eu entender o momento da Costa Mar?", createdAt: iso(-11, 10) },
  { id: "int-3", leadId: "lead-costamar", channel: "whatsapp", direction: "in", body: "Oi Ana! Pode ser quinta às 15h.", createdAt: iso(-11, 14) },
  { id: "int-4", leadId: "lead-costamar", channel: "call", author: "Ana Lima", body: "Reunião de descoberta realizada. Foco em captação de imóveis e leads no Instagram + Google.", createdAt: iso(-6, 15) },
  { id: "int-5", leadId: "lead-costamar", channel: "note", author: "Ana Lima", meta: { bant: { budget: "R$ 5.000/mês (incluso mídia)", authority: "Pedro Costa (sócio-diretor)", need: "Leads qualificados para captação de imóveis" } }, body: "Qualificação BANT preenchida durante a call.", createdAt: iso(-6, 16) },
  { id: "int-6", leadId: "lead-costamar", channel: "email", direction: "out", author: "Ana Lima", body: "Proposta comercial — Viofilme × Imobiliária Costa Mar (Social Pro + Tráfego). Segue em anexo.", createdAt: iso(-5, 9) },
  { id: "int-7", leadId: "lead-costamar", channel: "whatsapp", direction: "in", body: "Recebi a proposta, gostei! Quer fechar. Vamos alinhar o kickoff.", createdAt: iso(0, 11) },
];

export const MOCK_TASKS: CrmTask[] = [
  { id: "task-1", leadId: "lead-costamar", title: "Follow-up — confirmar data de início", dueDate: iso(0, 15), status: "pending", createdAt: iso(-1) },
  { id: "task-2", leadId: "lead-fitlife", title: "Ligar para FitLife — primeira abordagem", dueDate: iso(-2, 10), status: "pending", createdAt: iso(-3) },
  { id: "task-3", leadId: "lead-vilamar", title: "Retomar contato — proposta enviada", dueDate: iso(-1, 11), status: "pending", createdAt: iso(-4) },
  { id: "task-4", leadId: "lead-bela", title: "Reunião de descoberta", dueDate: iso(1, 14), status: "pending", createdAt: iso(-2) },
  { id: "task-5", leadId: "lead-farmacias", title: "Enviar contrato revisado", dueDate: iso(2, 11), status: "pending", createdAt: iso(-1) },
];

export const CRM_AGENDA: AgendaItem[] = [
  { time: "09:30", title: "Daily da equipe comercial", kind: "interno" },
  { time: "14:00", title: "Apresentação — Imobiliária Costa Mar", kind: "lead" },
  { time: "16:30", title: "Alinhamento com a diretoria — metas do mês", kind: "diretoria" },
];

export { REF as CRM_REFERENCE_ISO };
