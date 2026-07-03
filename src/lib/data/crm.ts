/**
 * Módulo 2 — CRM & Vendas (funil de aquisição).
 *
 * Client-safe: só tipos, dados mock e helpers PUROS (sem imports de servidor).
 * As leituras reais do Supabase ficam em `supabase.ts` (sbCrm*) e a delegação
 * dual-mode em `queries.ts` (getCrm*). As escritas ficam em /api/crm/*.
 */
import { REFERENCE_DATE } from "./mock";

// ── Tipos base ──────────────────────────────────────────────────────────────

/**
 * Key de estágio. Os 6 abaixo são os padrão (seed); com o pipeline editável,
 * novos estágios têm keys arbitrárias — por isso o tipo aceita qualquer string
 * (o `& {}` preserva o autocomplete das padrão).
 */
export type CrmStage =
  | "prospeccao"
  | "reuniao"
  | "proposta"
  | "negociacao"
  | "ganho"
  | "perdido"
  | (string & {});

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
  // CRM v2 (modelo HubSpot) — associações e customização
  companyId?: string;
  primaryContactId?: string;
  pipelineId?: string;
  stageId?: string;
  tags?: string[]; // ids de Tag
  properties?: Record<string, unknown>; // valores das propriedades customizadas
  createdAt: string;
  updatedAt: string;
};

/** Deal (negócio) = a oportunidade no funil. Alias semântico de CrmLead. */
export type Deal = CrmLead;

// ── CRM v2: objetos Empresa / Contato + customização ────────────────────────

export type Company = {
  id: string;
  name: string;
  segment?: string;
  website?: string;
  phone?: string;
  email?: string;
  city?: string;
  size?: string;
  owner?: string;
  tags: string[];
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type Contact = {
  id: string;
  companyId?: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  isPrimary: boolean;
  owner?: string;
  tags: string[];
  properties: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DealContact = {
  dealId: string;
  contactId: string;
  role?: string;
  isPrimary: boolean;
};

export type CrmObjectType = "company" | "contact" | "deal";

export type PropertyFieldType =
  | "text"
  | "number"
  | "currency"
  | "select"
  | "multiselect"
  | "date"
  | "checkbox"
  | "phone"
  | "email"
  | "url";

export type PropertyOption = { value: string; label: string; color?: string };

export type PropertyDef = {
  id: string;
  objectType: CrmObjectType;
  key: string;
  label: string;
  fieldType: PropertyFieldType;
  options: PropertyOption[];
  position: number;
  isDefault: boolean;
};

export type Tag = { id: string; name: string; color: string };

/** Operadores de um requisito de estágio. */
export type RequirementOp = "filled" | "true" | "equals" | "gt";

/** Regra que um negócio precisa cumprir para ENTRAR num estágio. */
export type StageRequirement = {
  source: "property" | "native"; // propriedade customizada ou campo nativo
  field: string; // key da propriedade ou coluna nativa (monthly_value, plan, source…)
  label: string; // rótulo exibido
  op: RequirementOp;
  value?: string; // usado por equals/gt
};

/** Ação disparada quando um negócio entra no estágio. */
export type StageAutomation =
  | { type: "task"; title: string; dueDays?: number }
  | { type: "whatsapp"; message: string }
  | { type: "notify"; message: string };

export const AUTOMATION_TYPES: { key: StageAutomation["type"]; label: string }[] = [
  { key: "task", label: "Criar tarefa de follow-up" },
  { key: "whatsapp", label: "Enviar WhatsApp ao contato" },
  { key: "notify", label: "Notificar o time" },
];

export type Stage = {
  id: string;
  key: string;
  label: string;
  color: string;
  probability: number;
  position: number;
  kind: "open" | "won" | "lost";
  requirements: StageRequirement[];
  automations: StageAutomation[];
};

/** Campos nativos do negócio disponíveis como requisito. */
export const NATIVE_DEAL_FIELDS: { key: string; label: string }[] = [
  { key: "monthly_value", label: "Valor mensal" },
  { key: "plan", label: "Plano" },
  { key: "source", label: "Origem" },
  { key: "probability", label: "Probabilidade" },
];

export const REQUIREMENT_OPS: { key: RequirementOp; label: string; needsValue: boolean }[] = [
  { key: "filled", label: "estiver preenchido", needsValue: false },
  { key: "true", label: "estiver marcado (sim)", needsValue: false },
  { key: "equals", label: "for igual a", needsValue: true },
  { key: "gt", label: "for maior que", needsValue: true },
];

/** Valor de um campo/propriedade do negócio para avaliar um requisito. */
export function dealValueForRequirement(deal: CrmLead, req: StageRequirement): unknown {
  if (req.source === "property") return deal.properties?.[req.field];
  switch (req.field) {
    case "monthly_value":
      return deal.monthlyValue;
    case "plan":
      return deal.plan;
    case "source":
      return deal.source;
    case "probability":
      return deal.probability;
    default:
      return undefined;
  }
}

/** Um requisito isolado foi cumprido? (avaliação pura de valor × operador) */
export function requirementMet(op: RequirementOp, value: unknown, target?: string): boolean {
  switch (op) {
    case "true":
      return value === true || value === "true";
    case "equals":
      return String(value ?? "") === String(target ?? "");
    case "gt":
      return Number(value ?? 0) > Number(target ?? 0);
    case "filled":
    default:
      return value != null && String(value).trim() !== "";
  }
}

/** Requisitos NÃO cumpridos para o negócio entrar no estágio. */
export function unmetStageRequirements(deal: CrmLead, stage: Stage): StageRequirement[] {
  return (stage.requirements ?? []).filter(
    (r) => !requirementMet(r.op, dealValueForRequirement(deal, r), r.value),
  );
}

export type Pipeline = {
  id: string;
  name: string;
  isDefault: boolean;
  position: number;
  stages: Stage[];
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

export const CRM_STAGES: {
  key: CrmStage;
  label: string;
  open: boolean;
  color: string;
  probability: number;
  kind: "open" | "won" | "lost";
}[] = [
  { key: "prospeccao", label: "Prospecção", open: true, color: "#64748b", probability: 20, kind: "open" },
  { key: "reuniao", label: "Reunião marcada", open: true, color: "#0ea5e9", probability: 40, kind: "open" },
  { key: "proposta", label: "Proposta enviada", open: true, color: "#8b5cf6", probability: 60, kind: "open" },
  { key: "negociacao", label: "Em negociação", open: true, color: "#f59e0b", probability: 75, kind: "open" },
  { key: "ganho", label: "Ganho", open: false, color: "#10b981", probability: 100, kind: "won" },
  { key: "perdido", label: "Perdido", open: false, color: "#f43f5e", probability: 0, kind: "lost" },
];

/** Pipeline default derivado das stages fixas (mock / fallback demo). */
export const DEFAULT_PIPELINE: Pipeline = {
  id: "pipeline-default",
  name: "Pipeline comercial",
  isDefault: true,
  position: 0,
  stages: CRM_STAGES.map((s, i) => ({
    id: s.key,
    key: s.key,
    label: s.label,
    color: s.color,
    probability: s.probability,
    position: i + 1,
    kind: s.kind,
    requirements: [],
    automations: [],
  })),
};

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

/**
 * Consolida os KPIs do dashboard BDR a partir de leads + tarefas.
 * `stages` (opcional) torna o funil dinâmico conforme o pipeline configurado;
 * sem ele, cai nos 6 estágios padrão.
 */
export function computeDashboard(
  leads: CrmLead[],
  tasks: CrmTask[],
  nowIso: string,
  stages?: Stage[],
): BdrDashboard {
  const now = new Date(nowIso);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  // Estágios abertos (do pipeline configurado ou dos padrão).
  const openStages = stages?.length
    ? stages.filter((s) => s.kind === "open")
    : CRM_STAGES.filter((s) => s.open).map((s, i) => ({
        id: s.key, key: s.key, label: s.label, color: s.color,
        probability: s.probability, position: i, kind: "open" as const,
      }));
  const openKeys = new Set(openStages.map((s) => s.key));

  const wonThisMonth = leads.filter((l) => l.wonAt && Date.parse(l.wonAt) >= Date.parse(monthStart));
  const lostThisMonth = leads.filter((l) => l.lostAt && Date.parse(l.lostAt) >= Date.parse(monthStart));
  const newMrr = wonThisMonth.reduce((s, l) => s + l.monthlyValue, 0);
  const closed = wonThisMonth.length + lostThisMonth.length;
  const winRate = closed ? Math.round((wonThisMonth.length / closed) * 100) : 0;
  const avgTicket = wonThisMonth.length ? Math.round(newMrr / wonThisMonth.length) : 0;

  const open = leads.filter((l) => openKeys.has(l.stage));
  // "Propostas em aberto": estágios abertos com probabilidade alta (≥60%).
  const proposalsOpen = open.filter((l) => {
    const st = openStages.find((s) => s.key === l.stage);
    return (st?.probability ?? l.probability) >= 60;
  });
  const pipelineOpenValue = open.reduce((s, l) => s + l.monthlyValue, 0);
  const pipelineWeighted = Math.round(
    open.reduce((s, l) => s + (l.monthlyValue * l.probability) / 100, 0),
  );

  const byStage: StageBucket[] = openStages.map((s) => {
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

// ── CRM v2: mock de Empresas/Contatos derivado dos leads + customização ──────

/** Empresas mock: uma por lead legado (espelha o backfill da migration). */
export const MOCK_COMPANIES: Company[] = MOCK_LEADS.map((l) => ({
  id: `co-${l.id}`,
  name: l.name,
  segment: l.segment,
  phone: l.contactPhone,
  email: l.contactEmail,
  owner: l.owner,
  tags: [],
  properties: {},
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
}));

/** Contatos mock: contato primário por lead legado. */
export const MOCK_CONTACTS: Contact[] = MOCK_LEADS.filter(
  (l) => l.contactName || l.contactPhone || l.contactEmail,
).map((l) => ({
  id: `ct-${l.id}`,
  companyId: `co-${l.id}`,
  name: l.contactName ?? l.name,
  phone: l.contactPhone,
  email: l.contactEmail,
  isPrimary: true,
  owner: l.owner,
  tags: [],
  properties: {},
  createdAt: l.createdAt,
  updatedAt: l.updatedAt,
}));

// Vincula os leads mock às empresas/contatos derivados (companyId/primaryContactId).
for (const l of MOCK_LEADS) {
  l.companyId = `co-${l.id}`;
  l.pipelineId = DEFAULT_PIPELINE.id;
  l.stageId = l.stage;
  l.tags = l.tags ?? [];
  l.properties = l.properties ?? {};
  if (MOCK_CONTACTS.some((c) => c.id === `ct-${l.id}`)) {
    l.primaryContactId = `ct-${l.id}`;
  }
}

export const MOCK_DEAL_CONTACTS: DealContact[] = MOCK_LEADS.filter(
  (l) => l.primaryContactId,
).map((l) => ({
  dealId: l.id,
  contactId: l.primaryContactId!,
  isPrimary: true,
}));

export const MOCK_TAGS: Tag[] = [
  { id: "tag-quente", name: "Quente", color: "#f43f5e" },
  { id: "tag-indicacao", name: "Indicação", color: "#10b981" },
  { id: "tag-enterprise", name: "Enterprise", color: "#8b5cf6" },
  { id: "tag-retomar", name: "Retomar", color: "#f59e0b" },
];

export const MOCK_PROPERTIES: PropertyDef[] = [
  { id: "prop-ig", objectType: "company", key: "instagram", label: "Instagram", fieldType: "text", options: [], position: 1, isDefault: true },
  { id: "prop-cnpj", objectType: "company", key: "cnpj", label: "CNPJ", fieldType: "text", options: [], position: 2, isDefault: true },
  { id: "prop-optin", objectType: "contact", key: "whatsapp_optin", label: "Aceita WhatsApp", fieldType: "checkbox", options: [], position: 1, isDefault: true },
  { id: "prop-conc", objectType: "deal", key: "concorrente", label: "Concorrente atual", fieldType: "text", options: [], position: 1, isDefault: true },
];

// ── Helpers de composição (Empresa com seus deals/contatos) ─────────────────

export type CompanyDetail = {
  company: Company;
  contacts: Contact[];
  deals: CrmLead[];
};

export function buildCompanyDetail(
  companyId: string,
  companies: Company[],
  contacts: Contact[],
  deals: CrmLead[],
): CompanyDetail | null {
  const company = companies.find((c) => c.id === companyId);
  if (!company) return null;
  return {
    company,
    contacts: contacts.filter((c) => c.companyId === companyId),
    deals: deals.filter((d) => d.companyId === companyId),
  };
}

/** Resolve a lista de tags (com cor) a partir de ids. */
export function resolveTags(ids: string[] | undefined, all: Tag[]): Tag[] {
  if (!ids?.length) return [];
  return ids.map((id) => all.find((t) => t.id === id)).filter((t): t is Tag => Boolean(t));
}

export type ContactDetail = {
  contact: Contact;
  company: Company | null;
  deals: CrmLead[];
};

/** Contato + empresa + negócios associados (primário OU via deal_contacts). */
export function buildContactDetail(
  contactId: string,
  contacts: Contact[],
  companies: Company[],
  deals: CrmLead[],
  dealContacts: DealContact[],
): ContactDetail | null {
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) return null;
  const dealIds = new Set<string>();
  for (const dc of dealContacts) if (dc.contactId === contactId) dealIds.add(dc.dealId);
  for (const d of deals) if (d.primaryContactId === contactId) dealIds.add(d.id);
  return {
    contact,
    company: companies.find((c) => c.id === contact.companyId) ?? null,
    deals: deals.filter((d) => dealIds.has(d.id)),
  };
}
