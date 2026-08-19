/**
 * Módulo 3 — Operação & Produção (dados mock).
 *
 * Vertical 1 (Hub de Clientes), 2 (Painel de Entregas) e 3 (Central de
 * Relatórios). Mock-first: a UI usa estes dados; as migrations equivalentes
 * serão ligadas ao Supabase depois.
 */
import { CS_CLIENTS } from "./cs";
import { REFERENCE_DATE } from "./mock";

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
  /** WhatsApp do cliente (dígitos), para ações rápidas. Ausente = sem número. */
  whatsapp?: string | null;
  /** Logo do cliente (URL pública). Ausente = mostra iniciais. */
  logoUrl?: string;
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

// --- Hub operacional (HUB00-08) ---------------------------------------------
// Escopo por squad modelado desde já (hoje só existe 1 squad).
export const SQUADS = [{ id: "sq-1", name: "Produção" }];

export type ResponsibleRole = "social" | "performance" | "designer" | "copy" | "desenvolvedor";
export const RESPONSIBLE_ROLES: { key: ResponsibleRole; label: string }[] = [
  { key: "social", label: "Social" },
  { key: "performance", label: "Performance" },
  { key: "designer", label: "Designer" },
  { key: "copy", label: "Editor de Vídeo" },
  { key: "desenvolvedor", label: "Desenvolvedor" },
];

/** Serviços contratados a partir do plano. */
export function servicesForPlan(plan: HubPlan): string[] {
  if (plan === "Full Service") return ["Tráfego", "Social", "Design", "UGC"];
  if (plan === "Tráfego + Social") return ["Tráfego", "Social"];
  return ["Social"];
}
export function deliverablesForPlan(plan: HubPlan): string {
  if (plan === "Full Service") return "16 posts · 6 reels · 4 criativos · UGC";
  if (plan === "Tráfego + Social") return "12 posts · 4 reels · 3 campanhas";
  return "12 posts · 4 reels";
}

/** Responsáveis por função (mock determinístico por índice). */
export function responsiblesFor(idx: number): Record<ResponsibleRole, string> {
  const socials = ["Ana Lima"];
  const perfs = ["Mariana"];
  const designers = ["Robert", "Lucas"];
  return {
    social: socials[0],
    performance: perfs[0],
    designer: designers[idx % designers.length],
    copy: "Gustavo",
    desenvolvedor: "",
  };
}

/** Casa a task (nome abreviado) ao cliente do Hub por tokens significativos. */
function normTokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4);
}
export function tasksForClientName(name: string, tasks: DeliveryTask[]): DeliveryTask[] {
  const a = new Set(normTokens(name));
  return tasks.filter((t) => normTokens(t.client).some((w) => a.has(w)));
}

/** Tarefas do cliente (para a aba Tarefas e o Resumo da página interna). */
export function getClientTasks(clientName: string): DeliveryTask[] {
  return tasksForClientName(clientName, getDeliveryTasks());
}

export type HubSemaforo = {
  state: "em-dia" | "atrasado" | "aguardando";
  late: number;
  approval: number;
};
export type HubResponsibles = Record<ResponsibleRole, string>;

/**
 * "LE do próximo mês" (HUB06.1). `tone` já vem calculado (o servidor conhece a
 * data de hoje) para o card mudar de cor conforme o prazo aperta:
 * ok=montada · neutral=pendente longe · warn=pendente perto · late=vencida.
 */
export type LeTone = "ok" | "neutral" | "warn" | "late";
export type LeNextMonth = {
  /** "—" = não se aplica (ex.: cliente pontual/projeto, sem ciclo editorial). */
  status: "montada" | "pendente" | "—";
  date?: string;
  tone: LeTone;
};

/** Dia do mês (convenção da agência) em que a LE do mês seguinte deve estar montada. */
export const LE_DEADLINE_DAY = 25;

/** Calcula o tom da "LE próximo mês" a partir do status e do dia de hoje. */
export function leToneFrom(status: "montada" | "pendente", dayOfMonth: number): LeTone {
  if (status === "montada") return "ok";
  if (dayOfMonth > LE_DEADLINE_DAY) return "late";
  if (dayOfMonth >= LE_DEADLINE_DAY - 3) return "warn";
  return "neutral";
}

export type HubClientOps = HubClient & {
  squadId: string;
  squadName: string;
  responsibles: HubResponsibles;
  services: string[];
  deliverables: string;
  monthTotal: number;
  monthDone: number;
  monthApproval: number;
  leNextMonth: LeNextMonth;
  nextAgenda?: string;
  semaforo: HubSemaforo;
};

/** Precedência: atraso vence; aguardando cliente é sub-info. */
export function semaforoFrom(tasks: DeliveryTask[]): HubSemaforo {
  const late = tasks.filter((t) => t.late).length;
  const approval = tasks.filter((t) => t.stage === "approval").length;
  const state = late > 0 ? "atrasado" : approval > 0 ? "aguardando" : "em-dia";
  return { state, late, approval };
}

export function getHubClientsOps(): HubClientOps[] {
  const tasks = getDeliveryTasks();
  const today = new Date().getDate();
  return getHubClients().map((c, idx) => {
    const t = tasksForClientName(c.name, tasks);
    const monthDone = t.filter((x) => x.stage === "done").length;
    const monthApproval = t.filter((x) => x.stage === "approval").length;
    const leMounted = idx % 3 !== 0; // mock: maioria montada
    const leStatus = leMounted ? "montada" : "pendente";
    return {
      ...c,
      squadId: "sq-1",
      squadName: "Produção",
      responsibles: responsiblesFor(idx),
      services: servicesForPlan(c.plan),
      deliverables: deliverablesForPlan(c.plan),
      monthTotal: t.length,
      monthDone,
      monthApproval,
      leNextMonth: {
        status: leStatus,
        date: leMounted ? `até ${LE_DEADLINE_DAY}` : `prazo ${LE_DEADLINE_DAY}`,
        tone: leToneFrom(leStatus, today),
      },
      nextAgenda: c.onboarding ? "Kickoff · esta semana" : "Alinhamento mensal · 26/06 10h",
      semaforo: semaforoFrom(t),
    };
  });
}

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

/** Estudo do negócio por etapa (HUB11) — mock. */
const VIOLAUNCH_DETAIL: Record<string, { entregas: string; notes: string }> = {
  "Contrato assinado": { entregas: "Contrato + escopo + fee acordado", notes: "Plano contratado e ciclo de faturamento definidos." },
  "Acessos & integrações": { entregas: "Meta, Google, IG Business, GA4", notes: "Conferir permissões de administrador e pixel." },
  "Briefing estratégico": { entregas: "Objetivo, tom de voz, público, concorrentes, restrições", notes: "Estudo do negócio: proposta de valor e diferenciais." },
  "Planejamento inicial": { entregas: "Pilares, narrativa e metas do 1º mês", notes: "Base para a primeira Linha Editorial." },
  "Setup de tráfego": { entregas: "Contas de anúncio, públicos, conversões", notes: "Configurar eventos e orçamento inicial." },
  "Primeira linha editorial": { entregas: "LE do 1º mês aprovada", notes: "Validada em reunião com o cliente." },
  "Kickoff com o cliente": { entregas: "Reunião de alinhamento + cronograma", notes: "Expectativas e cadência de reuniões definidas." },
  "Primeira entrega": { entregas: "Primeiros ativos publicados", notes: "Marco de início da operação recorrente." },
};

export type VioLaunchStep = {
  label: string;
  done: boolean;
  date: string;
  entregas: string;
  notes: string;
};

export function getVioLaunch(clientId: string) {
  const c = getHubClients().find((x) => x.id === clientId);
  const total = VIOLAUNCH_STEPS.length;
  const done = c?.onboarding?.step ?? total; // ativos = onboarding concluído
  const start = c?.onboarding?.startDate ?? "—";
  const steps: VioLaunchStep[] = VIOLAUNCH_STEPS.map((label, i) => ({
    label,
    done: i < done,
    date: i < done ? `${String((i % 28) + 1).padStart(2, "0")}/07` : "a definir",
    entregas: VIOLAUNCH_DETAIL[label]?.entregas ?? "—",
    notes: VIOLAUNCH_DETAIL[label]?.notes ?? "",
  }));
  return { step: done, total, startDate: start, steps };
}

// --- Documentos do cliente ---------------------------------------------------
export type ClientDoc = { id: string; title: string; meta: string; kind: string };

// --- VioDay / Media Day (HUB12) ---------------------------------------------
export type CaptureStatus = "pending" | "done" | "reshoot";
export type FootageStatus = "awaiting" | "raw_delivered" | "editing" | "final";
export type MediaDayStatus = "planning" | "ready" | "shot" | "delivered";

export type MediaDaySession = {
  scheduledLabel: string;
  location: string;
  team: string;
  equipment: string;
  notes: string;
  status: MediaDayStatus;
  /** Pós/entrega — estado global do dia (VD03). */
  postStatus: FootageStatus;
};

/** Estado persistido de um item de captura (vinculado a um post da LE). */
export type MediaDayItemState = {
  postId: string;
  taskId?: string;
  captureStatus: CaptureStatus;
  footageStatus: FootageStatus;
  rawAssets: string[];
};

export type MediaDayView = {
  session: MediaDaySession | null;
  items: MediaDayItemState[];
};

export const FOOTAGE_STAGES: { key: FootageStatus; label: string }[] = [
  { key: "awaiting", label: "Aguardando captação" },
  { key: "raw_delivered", label: "Brutos entregues" },
  { key: "editing", label: "Em edição" },
  { key: "final", label: "Entregue final" },
];

export type ClientDocument = {
  id: string;
  title: string;
  url: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  kind: string; // contrato|briefing|marca|relatorio|outro
  createdAt?: string;
};

export const DOCUMENT_KINDS: { key: string; label: string }[] = [
  { key: "contrato", label: "Contrato" },
  { key: "briefing", label: "Briefing" },
  { key: "marca", label: "Manual de marca" },
  { key: "relatorio", label: "Relatório" },
  { key: "outro", label: "Outro" },
];

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
  | "rascunho"
  | "em_producao"
  | "aprovacao_interna"
  | "em_aprovacao"
  | "em_postagem"
  | "concluida";

export const EDITORIAL_STAGES: { key: EditorialStage; label: string }[] = [
  { key: "rascunho", label: "Para fazer" },
  { key: "em_producao", label: "Em produção" },
  { key: "aprovacao_interna", label: "Aprovação interna" },
  { key: "em_aprovacao", label: "Em aprovação" },
  { key: "em_postagem", label: "Em postagem" },
  { key: "concluida", label: "Concluída" },
];

/** Normaliza estágios legados (antes da separação aprovação/postagem). */
export function normalizeEditorialStage(raw: string | null | undefined): EditorialStage {
  if (raw === "ativa") return "em_postagem";
  if (raw === "ideacao" || !raw) return "rascunho";
  return (EDITORIAL_STAGES.some((s) => s.key === raw) ? raw : "rascunho") as EditorialStage;
}

/** Card do quadro (kanban) de linhas editoriais — resumo de uma LE. */
export type EditorialLineCard = {
  id: string;
  month: string;
  referenceMonth?: string;
  stage: EditorialStage;
  objetivo?: string;
  builtBy?: string;
  updatedAt?: string;
  postsCount: number;
  approvedCount: number;
};

export type EditorialFormat = "Feed" | "Reels" | "Stories" | "Carrossel";

export type ClientDeliverable = { format: EditorialFormat; monthlyQty: number };

/** Direcionamento de arte (HUB09.3) — a escolha dispara consequências. */
export type ArtDirection =
  | "Media Day"
  | "Imagem da internet"
  | "Banco do cliente"
  | "Motion design"
  | "Outro";

export const ART_DIRECTIONS: ArtDirection[] = [
  "Media Day",
  "Imagem da internet",
  "Banco do cliente",
  "Motion design",
  "Outro",
];

/** Referência/inspiração (HUB09.2) — alimenta o moodboard. */
export type EditorialRef = {
  id: string;
  kind: "image" | "instagram" | "pinterest" | "link";
  url?: string;
  label?: string;
};

/** Decupagem do vídeo (shotlist): tempo · imagem · legenda — a tabela do PDF. */
export type EditorialShot = { tempo: string; imagem: string; legenda: string };

export type EditorialPost = {
  id?: string;
  n: number;
  date: string; // "01/07"
  weekday: string; // "seg"
  title: string;
  format: EditorialFormat;
  pillar: string;
  description: string;
  assetNote: string;
  artDirection: ArtDirection;
  references: EditorialRef[];
  /** Decupagem (shotlist) do vídeo — alimenta a tabela da apresentação. */
  shotlist?: EditorialShot[];
  /** Estágio real da delivery task gerada (live-sync do Kanban), se houver. */
  taskStage?: TaskStage;
  /** Campos da ficha (Task universal). */
  tema?: string;
  legenda?: string;
  notes?: string;
  assignee?: string;
  assigneeSecondary?: string;
  priority?: "normal" | "urgente";
  taskId?: string;
  /** Duas datas (C3). ISO "AAAA-MM-DD". */
  postDateIso?: string;
  deliveryDate?: string;
  deliveryOverridden?: boolean;
  /** Data comemorativa vinculada (label da LE), opcional (C3.1). */
  commemorativeDate?: string;
  /** Nº de comentários na task vinculada (contador do card, B1). */
  commentsCount?: number;
  /** Checklist de entrega salvo na task (para reidratar a ficha). */
  checklist?: { label: string; done: boolean }[];
  /** Decisão do cliente no link público de aprovação. */
  clientStatus?: "pending" | "approved" | "changes";
  clientFeedback?: string;
  clientReviewedAt?: string;
};

export type EditorialPillar = { name: string; posts: number; color: string };

/** Rascunho de LE em aberto (A3) — para retomar no modal Nova LE. */
export type EditorialDraft = { id: string; month: string; objetivo?: string; updatedAt?: string };

export type EditorialLine = {
  id?: string;
  clientName: string;
  month: string;
  objetivo?: string;
  builtBy?: string;
  internallyApprovedBy?: string;
  createdBy: string;
  stage: EditorialStage;
  frequency: string;
  networks: string;
  responsibles: string;
  approvalMeeting: string;
  /** Cabeçalho estratégico (macro) — HUB09.1 */
  datasComemorativas: string;
  narrativaCentral: string;
  tensaoNarrativa: string;
  moodboardGeral: EditorialRef[];
  pillars: EditorialPillar[];
  posts: EditorialPost[];
  history: { id: string; month: string }[];
  /** Token do link público de aprovação pelo cliente (/aprovar/<token>). */
  approvalToken?: string;
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
export type DeliveryPriority = "baixa" | "media" | "alta" | "urgente";

/** Comentário rico (Fase 2): threads (1 nível), reações e anexos. */
export type TaskComment = {
  id?: string;
  author: string;
  text: string;
  parentId?: string;
  reactions?: Record<string, string[]>; // emoji -> autores
  attachments?: { name: string; url: string }[];
  mentions?: string[]; // nomes mencionados (@)
  createdAt?: string;
};

export const REACTION_EMOJIS = ["👍", "❤️", "🎉", "🔥", "👀"];

/** Notificação de menção (@) exibida no Meu dia. */
export type MentionNotice = {
  id: string;
  title: string;
  body?: string;
  url?: string;
  read: boolean;
  createdAt: string;
};

/** Campos personalizados por board (Fase 3). */
export type DeliveryFieldType = "text" | "textarea" | "number" | "select" | "date" | "checkbox" | "url";
export type DeliveryFormField = {
  id: string;
  fieldKey: string;
  label: string;
  fieldType: DeliveryFieldType;
  options: { value: string; label: string }[];
  required: boolean;
  position: number;
  active: boolean;
};
export const DELIVERY_FIELD_TYPES: { key: DeliveryFieldType; label: string }[] = [
  { key: "text", label: "Texto" },
  { key: "textarea", label: "Texto longo" },
  { key: "number", label: "Número" },
  { key: "select", label: "Seleção" },
  { key: "date", label: "Data" },
  { key: "checkbox", label: "Sim/Não" },
  { key: "url", label: "Link" },
];

export const DELIVERY_PRIORITIES: { key: DeliveryPriority; label: string; chip: string; dot: string }[] = [
  { key: "baixa", label: "Baixa", chip: "bg-subtle text-muted", dot: "bg-slate-400" },
  { key: "media", label: "Média", chip: "bg-sky-500/15 text-sky-500", dot: "bg-sky-500" },
  { key: "alta", label: "Alta", chip: "bg-orange-500/15 text-orange-600", dot: "bg-orange-500" },
  { key: "urgente", label: "Urgente", chip: "bg-rose-500/15 text-rose-500", dot: "bg-rose-500" },
];
export type TaskType = "Arte" | "Vídeo" | "Copy" | "Tráfego";
export type TaskOrigin = "Linha editorial" | "Projeto" | "Tarefa avulsa" | "Performance";
export type CampaignGoal = "conversao" | "trafego" | "alcance" | "reconhecimento";

// Estágios canônicos do objeto task — Kanban, LE e Resumo usam os mesmos nomes.
export const TASK_STAGES: { key: TaskStage; label: string }[] = [
  { key: "todo", label: "Backlog" },
  { key: "doing", label: "Em produção" },
  { key: "review", label: "Revisão interna" },
  { key: "approval", label: "Aguardando cliente" },
  { key: "done", label: "Aprovado/Publicado" },
];

/** Capacidade compartilhada: nº de tasks/dia por pessoa (alerta de cor). */
export const DELIVERY_CAPACITY_PER_DAY = 4;

/** Duração padrão por tipo de task (min) — base da Timeline (ENT10). Fallback. */
export const TASK_TYPE_DURATIONS: Record<TaskType, number> = {
  Arte: 90,
  Vídeo: 180,
  Copy: 45,
  Tráfego: 60,
};

/**
 * Config do Painel de Entregas (ENT10/ENT12). Real quando Supabase ligado
 * (task_types + delivery_settings); cai nas constantes acima no mock.
 */
export type DeliveryConfig = {
  capacityPerDay: number;
  typeDurations: Record<string, number>;
  /** Padrões por tipo (criação via formulário): responsável + SLA (dias úteis). */
  typeDefaults?: Record<string, { assignee: string; slaDays: number }>;
  /** Campos principais exibidos no card (padrão da equipe). */
  cardFields?: string[];
};

export const DELIVERY_CONFIG_FALLBACK: DeliveryConfig = {
  capacityPerDay: DELIVERY_CAPACITY_PER_DAY,
  typeDurations: { ...TASK_TYPE_DURATIONS },
  typeDefaults: {},
};

/**
 * Prazo de entrega (C3): quarta-feira da semana ANTERIOR à da postagem.
 * Regra: a partir de post_date, acha a segunda-feira daquela semana e subtrai 5
 * dias → quarta da semana anterior. Recebe/retorna "AAAA-MM-DD".
 * Ex.: postagem sáb 22/08 → entrega qua 12/08; seg 10/08 → qua 05/08.
 */
export function deliveryDateFor(postIso: string): string {
  if (!postIso) return "";
  const d = new Date(`${postIso}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  const dow = d.getUTCDay(); // 0=Dom..6=Sáb
  const toMonday = (dow + 6) % 7; // dias desde a segunda daquela semana
  d.setUTCDate(d.getUTCDate() - toMonday - 5); // segunda - 5 = quarta da semana anterior
  return d.toISOString().slice(0, 10);
}

/** Formata "AAAA-MM-DD" como "DD/MM". */
export function ddmmFromIso(iso: string): string {
  if (!iso || iso.length < 10) return "";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Data de entrega (ISO) a partir do índice do dia (0=Seg da semana atual). */
function deliveryDate(dayIdx: number): string {
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() + dayIdx);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString();
}

/** "Hoje" do Painel de Entregas (quarta da semana de referência). */
export const DELIVERY_TODAY_ISO = deliveryDate(2);
export const DELIVERY_TODAY_IDX = 2;

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
  dueDate: string; // ISO — data de entrega real (ENT09)
  /** Detalhes persistidos (Painel real). Ausentes no mock. */
  checklist?: { label: string; done: boolean }[];
  comments?: TaskComment[];
  /** Card v2 (modelo Sprints). */
  priority?: DeliveryPriority;
  assignees?: string[];
  requester?: string;
  movedAt?: string;
  /** Criação e conclusão (etapa terminal) — base das métricas de produtividade. */
  createdAt?: string;
  completedAt?: string;
  customFields?: Record<string, unknown>;
  /** Override de duração (min) da Timeline; herda do tipo quando ausente (ENT10). */
  durationMin?: number;
  /** Conteúdo (C1.1 — ficha única): tema/roteiro/legenda/refs + duas datas. */
  tema?: string;
  roteiro?: string;
  legenda?: string;
  refs?: EditorialRef[];
  postDateIso?: string;
  deliveryDate?: string;
  deliveryOverridden?: boolean;
  commemorativeDate?: string;
  /** Criativo de performance (HUB10). */
  campaignGoal?: CampaignGoal;
  contentFormat?: EditorialFormat;
};

/** Mapeia uma delivery task para o shape da ficha canônica (C1.1 — ficha única). */
export function deliveryTaskToPost(t: DeliveryTask): EditorialPost {
  return {
    id: t.id,
    n: 0,
    date: "—",
    weekday: "—",
    title: t.title,
    format: (t.contentFormat ?? "Feed") as EditorialFormat,
    pillar: "",
    description: t.roteiro ?? "",
    assetNote: "",
    artDirection: "Banco do cliente",
    references: t.refs ?? [],
    taskStage: t.stage,
    tema: t.tema,
    legenda: t.legenda,
    assignee: t.assignee || t.assignees?.[0],
    priority: t.priority === "urgente" ? "urgente" : "normal",
    taskId: t.id,
    postDateIso: t.postDateIso,
    deliveryDate: t.deliveryDate,
    deliveryOverridden: t.deliveryOverridden,
    commemorativeDate: t.commemorativeDate,
    checklist: t.checklist,
  };
}

export function getDeliveryTasks(): DeliveryTask[] {
  const base: Omit<DeliveryTask, "dueDate">[] = [
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

  // Adiciona a data de entrega real e recalcula "atrasada" pela régua da data
  // (aprovação cliente e concluída não contam como atraso da cozinha).
  return base.map((t) => ({
    ...t,
    dueDate: deliveryDate(t.day),
    late: t.day < DELIVERY_TODAY_IDX && t.stage !== "done" && t.stage !== "approval",
  }));
}

function artDirectionFromNote(note: string): ArtDirection {
  const n = note.toLowerCase();
  if (n.includes("media day")) return "Media Day";
  if (n.includes("artes") || n.includes("motion")) return "Motion design";
  if (n.includes("estúdio") || n.includes("cliente")) return "Banco do cliente";
  if (n.includes("template")) return "Outro";
  return "Imagem da internet";
}

export function getEditorialLine(clientId: string): EditorialLine {
  const client = getHubClients().find((c) => c.id === clientId);
  const rawPosts: Omit<EditorialPost, "artDirection" | "references">[] = [
    { n: 1, date: "01/07", weekday: "seg", title: "Abertura do mês: boas-vindas a julho com o novo cardápio", format: "Feed", pillar: "Cardápio & produto", description: "Post estático. Legenda celebratória apresentando as novidades do mês.", assetNote: "Foto estúdio" },
    { n: 2, date: "03/07", weekday: "qua", title: "Reels: o chef revela o segredo do camarão", format: "Reels", pillar: "Bastidores & autenticidade", description: "Vídeo de bastidores. Corte rápido, narração do chef.", assetNote: "Gravar no Media Day · 28/06" },
    { n: 3, date: "04/07", weekday: "qui", title: "Stories: enquete — qual prato pedir essa semana?", format: "Stories", pillar: "Experiência & reservas", description: "Sequência interativa com 4 opções. Responder nos stories seguintes.", assetNote: "Template Stories" },
    { n: 4, date: "07/07", weekday: "seg", title: "Carrossel: 5 motivos para experimentar a degustação", format: "Carrossel", pillar: "Cardápio & produto", description: "5 cards. Capa impactante, slides 2 a 5 com cada motivo.", assetNote: "6 artes separadas" },
    { n: 5, date: "09/07", weekday: "qua", title: "Peixe do dia & a seleção semanal direta do mercado", format: "Feed", pillar: "Educação & contexto", description: "Foto do peixe no estoque. Legenda informativa sobre procedência.", assetNote: "Foto cliente ou stock" },
    { n: 6, date: "11/07", weekday: "sex", title: "Reels: harmonização do menu degustação com vinhos", format: "Reels", pillar: "Cardápio & produto", description: "Sommelier explica os pares. Ritmo calmo, foco no produto.", assetNote: "Gravar no Media Day · 28/06" },
    { n: 7, date: "14/07", weekday: "seg", title: "Depoimento real de cliente sobre a experiência", format: "Feed", pillar: "Experiência & reservas", description: "Print/foto do cliente com a citação em destaque.", assetNote: "Coletar autorização" },
    { n: 8, date: "16/07", weekday: "qua", title: "Bastidores: a chegada dos ingredientes frescos", format: "Stories", pillar: "Bastidores & autenticidade", description: "Sequência curta mostrando o recebimento da manhã.", assetNote: "Gravar no dia" },
  ];
  return {
    clientName: client?.name ?? "Cliente",
    month: "Julho / 2025",
    createdBy: "Ana Lima · Social Media",
    stage: "em_postagem",
    frequency: "5 posts/semana · 22 ativos",
    networks: "Instagram · Facebook",
    responsibles: "Ana Lima (SM) + Robert (Design)",
    approvalMeeting: "26/06 às 10h · hoje",
    datasComemorativas: "Dia do Sorvete (23/07) · Dia dos Pais (2ª quinzena de ago)",
    narrativaCentral: "Julho da experiência: o restaurante como destino gastronômico do inverno.",
    tensaoNarrativa: "Sair do 'só comida' e vender experiência/ocasião — reservas e degustação.",
    moodboardGeral: [
      { id: "mg1", kind: "pinterest", url: "https://pinterest.com/board/inverno-gastro", label: "Paleta inverno" },
      { id: "mg2", kind: "instagram", url: "https://instagram.com/p/exemplo", label: "Ref. bastidores" },
    ],
    pillars: [
      { name: "Bastidores & autenticidade", posts: 6, color: "#f59e0b" },
      { name: "Cardápio & produto", posts: 7, color: "#34d399" },
      { name: "Experiência & reservas", posts: 5, color: "#38bdf8" },
      { name: "Educação & contexto", posts: 4, color: "#a855f7" },
    ],
    posts: rawPosts.map((p) => ({
      ...p,
      artDirection: artDirectionFromNote(p.assetNote),
      references:
        p.n === 2
          ? [{ id: `r-${p.n}`, kind: "instagram", url: "https://instagram.com/reel/ref", label: "Ritmo do corte" }]
          : [],
    })),
    history: [
      { id: "le-jun", month: "Junho / 2025" },
      { id: "le-mai", month: "Maio / 2025" },
    ],
  };
}
