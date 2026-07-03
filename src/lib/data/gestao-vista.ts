/**
 * Módulo Operação — Gestão à Vista (GAV01–GAV08).
 *
 * Painel de LEITURA: 3 lentes (Tráfego, Social, Liderança) sobre a mesma base
 * (métrica × cliente × responsável × período). Client-safe: só tipos, mock e
 * helpers puros. As metas (client_goals) são reais (ver queries.ts); as
 * métricas de tráfego/orgânico são mock até a integração Meta acender (GAV07).
 */

// ── Metas (client_goals) ─────────────────────────────────────────────────────

export type GoalMetric =
  | "conversions"
  | "revenue"
  | "cpl"
  | "roas"
  | "followers_growth"
  | "engagement_rate";

export type GoalUnit = "int" | "brl" | "x" | "pct";

export const GOAL_METRICS: {
  key: GoalMetric;
  label: string;
  unit: GoalUnit;
  higherBetter: boolean;
}[] = [
  { key: "conversions", label: "Conversões", unit: "int", higherBetter: true },
  { key: "revenue", label: "Faturamento gerado", unit: "brl", higherBetter: true },
  { key: "cpl", label: "CPL (custo por lead)", unit: "brl", higherBetter: false },
  { key: "roas", label: "ROAS", unit: "x", higherBetter: true },
  { key: "followers_growth", label: "Crescimento de seguidores", unit: "int", higherBetter: true },
  { key: "engagement_rate", label: "Taxa de engajamento (%)", unit: "pct", higherBetter: true },
];

export function metricMeta(key: GoalMetric) {
  return GOAL_METRICS.find((m) => m.key === key)!;
}

export type ClientGoal = {
  clientId: string;
  metric: GoalMetric;
  targetValue: number;
  period: string; // 'YYYY-MM'
};

/** Competência atual 'YYYY-MM' a partir de uma data de referência ISO. */
export function periodFromIso(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

const MESES = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** 'YYYY-MM' → 'set/2025'. */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MESES[(m ?? 1) - 1]}/${y}`;
}

/** Lista de competências (atual + N anteriores) a partir de uma referência. */
export function recentPeriods(refIso: string, count = 6): string[] {
  const d = new Date(refIso);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

export function formatGoalValue(value: number, unit: GoalUnit): string {
  if (unit === "brl")
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
  if (unit === "x") return `${value.toFixed(1)}x`;
  if (unit === "pct") return `${value.toFixed(1)}%`;
  return value.toLocaleString("pt-BR");
}

// ── Base mock (métrica × cliente × responsável) ──────────────────────────────

export type ClientType = "ecommerce" | "lead_gen" | "local_business";

export type GavClient = {
  id: string;
  name: string;
  clientType: ClientType;
  trafficManager: string;
  socialAnalyst: string;
  traffic: {
    reach: number;
    clicks: number;
    ctr: number; // %
    conversions: number;
    spend: number;
    revenue: number; // faturamento gerado (valor de conversão — fonte Meta)
    cpl: number;
    roas: number;
  };
  social: {
    engagementRate: number; // %
    commentRate: number; // %
    followersGrowth: number;
    engagement: number; // interações absolutas
  };
  /** Formato de conteúdo dominante (para GAV04 — vocação). */
  topFormat: "UGC" | "Motion" | "Estático" | "Reels";
};

export const GAV_CLIENTS: GavClient[] = [
  {
    id: "cli-imob", name: "Imobiliária Costa Mar", clientType: "lead_gen",
    trafficManager: "Ana Lima", socialAnalyst: "Robert Oliveira",
    traffic: { reach: 182000, clicks: 5400, ctr: 2.9, conversions: 148, spend: 5200, revenue: 74000, cpl: 35.1, roas: 4.2 },
    social: { engagementRate: 4.1, commentRate: 0.9, followersGrowth: 620, engagement: 8200 },
    topFormat: "Reels",
  },
  {
    id: "cli-fit", name: "Academia FitLife", clientType: "local_business",
    trafficManager: "Marcos Silva", socialAnalyst: "Camila Souza",
    traffic: { reach: 96000, clicks: 3100, ctr: 3.2, conversions: 92, spend: 2800, revenue: 28000, cpl: 30.4, roas: 3.1 },
    social: { engagementRate: 5.2, commentRate: 1.3, followersGrowth: 410, engagement: 6100 },
    topFormat: "UGC",
  },
  {
    id: "cli-odonto", name: "Clínica Odonto Plus", clientType: "lead_gen",
    trafficManager: "Ana Lima", socialAnalyst: "Camila Souza",
    traffic: { reach: 74000, clicks: 2200, ctr: 3.0, conversions: 61, spend: 3500, revenue: 41000, cpl: 57.4, roas: 2.4 },
    social: { engagementRate: 3.4, commentRate: 0.6, followersGrowth: 280, engagement: 3900 },
    topFormat: "Estático",
  },
  {
    id: "cli-farm", name: "Rede de Farmácias BH", clientType: "ecommerce",
    trafficManager: "Marcos Silva", socialAnalyst: "Robert Oliveira",
    traffic: { reach: 320000, clicks: 9800, ctr: 3.1, conversions: 540, spend: 8500, revenue: 210000, cpl: 15.7, roas: 6.1 },
    social: { engagementRate: 2.9, commentRate: 0.5, followersGrowth: 1400, engagement: 14200 },
    topFormat: "Motion",
  },
  {
    id: "cli-studio", name: "Studio Bela Forma", clientType: "local_business",
    trafficManager: "Marcos Silva", socialAnalyst: "Camila Souza",
    traffic: { reach: 61000, clicks: 1900, ctr: 3.1, conversions: 48, spend: 2400, revenue: 19000, cpl: 50.0, roas: 2.0 },
    social: { engagementRate: 6.0, commentRate: 1.6, followersGrowth: 520, engagement: 7300 },
    topFormat: "UGC",
  },
  {
    id: "cli-moda", name: "Moda Litoral", clientType: "ecommerce",
    trafficManager: "Ana Lima", socialAnalyst: "Robert Oliveira",
    traffic: { reach: 148000, clicks: 6100, ctr: 4.1, conversions: 210, spend: 4200, revenue: 96000, cpl: 20.0, roas: 5.2 },
    social: { engagementRate: 3.8, commentRate: 0.8, followersGrowth: 980, engagement: 9100 },
    topFormat: "Reels",
  },
];

// Pools de responsáveis (mock até client_responsibles existir no Hub).
const TRAFFIC_POOL = ["Ana Lima", "Marcos Silva"];
const SOCIAL_POOL = ["Robert Oliveira", "Camila Souza"];
const FORMATS = ["UGC", "Motion", "Estático", "Reels"] as const;

function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** PRNG determinístico (mulberry32) — mesmas métricas mock para o mesmo id. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Monta a base da Gestão à Vista a partir dos clientes REAIS, com métricas
 * mock determinísticas por id (até a integração Meta acender — GAV07). Assim as
 * metas cadastradas (client_goals, por id real) casam no termômetro.
 */
export function buildGavClients(
  reals: { id: string; name: string; clientType?: ClientType }[],
): GavClient[] {
  return reals.map((c, i) => {
    const rand = rng(seedFrom(c.id));
    const clientType =
      c.clientType ?? (["ecommerce", "lead_gen", "local_business"] as ClientType[])[i % 3];
    const spend = 2000 + Math.round(rand() * 7000);
    const conversions = 40 + Math.round(rand() * 500);
    const cpl = Math.round((spend / Math.max(1, conversions)) * 10) / 10;
    const roas = Math.round((2 + rand() * 4) * 10) / 10;
    const revenue = Math.round(spend * roas);
    const clicks = 1500 + Math.round(rand() * 8000);
    const reach = clicks * (20 + Math.round(rand() * 20));
    const ctr = Math.round((clicks / reach) * 1000) / 10;
    return {
      id: c.id,
      name: c.name,
      clientType,
      trafficManager: TRAFFIC_POOL[i % TRAFFIC_POOL.length],
      socialAnalyst: SOCIAL_POOL[i % SOCIAL_POOL.length],
      traffic: { reach, clicks, ctr, conversions, spend, revenue, cpl, roas },
      social: {
        engagementRate: Math.round((2 + rand() * 5) * 10) / 10,
        commentRate: Math.round((0.4 + rand() * 1.4) * 10) / 10,
        followersGrowth: 100 + Math.round(rand() * 1400),
        engagement: 2000 + Math.round(rand() * 13000),
      },
      topFormat: FORMATS[Math.floor(rand() * FORMATS.length)],
    };
  });
}

/** Métrica primária do termômetro por tipo de cliente. */
export function primaryMetricFor(type: ClientType): GoalMetric {
  if (type === "ecommerce") return "roas";
  if (type === "lead_gen") return "cpl";
  return "conversions";
}

function actualOf(c: GavClient, metric: GoalMetric): number {
  switch (metric) {
    case "conversions": return c.traffic.conversions;
    case "revenue": return c.traffic.revenue;
    case "cpl": return c.traffic.cpl;
    case "roas": return c.traffic.roas;
    case "followers_growth": return c.social.followersGrowth;
    case "engagement_rate": return c.social.engagementRate;
  }
}

// ── Lente Tráfego (GAV02) ────────────────────────────────────────────────────

export type ClientHealth = {
  id: string;
  name: string;
  clientType: ClientType;
  manager: string;
  metric: GoalMetric;
  actual: number;
  target?: number;
  attainment?: number; // 0..1+ (respeitando higherBetter)
  status: "healthy" | "risk" | "no-goal";
};

/** Grau de atingimento da meta (higherBetter: actual/target; senão target/actual). */
function attainmentOf(actual: number, target: number, higherBetter: boolean): number {
  if (target <= 0) return 0;
  return higherBetter ? actual / target : target / actual;
}

export function buildHealth(
  clients: GavClient[],
  goals: ClientGoal[],
): ClientHealth[] {
  return clients.map((c) => {
    const clientGoals = goals.filter((g) => g.clientId === c.id);
    // Métrica avaliada: a primária do tipo, se houver meta; senão a 1ª meta
    // cadastrada (ordem de GOAL_METRICS). Assim qualquer meta "acende" a conta.
    const primary = primaryMetricFor(c.clientType);
    let goal = clientGoals.find((g) => g.metric === primary);
    if (!goal) {
      goal = GOAL_METRICS.map((m) => clientGoals.find((g) => g.metric === m.key)).find(
        (g): g is ClientGoal => !!g,
      );
    }
    if (!goal) {
      const metric = primary;
      return {
        id: c.id, name: c.name, clientType: c.clientType, manager: c.trafficManager,
        metric, actual: actualOf(c, metric), status: "no-goal" as const,
      };
    }
    const meta = metricMeta(goal.metric);
    const actual = actualOf(c, goal.metric);
    const attainment = attainmentOf(actual, goal.targetValue, meta.higherBetter);
    return {
      id: c.id, name: c.name, clientType: c.clientType, manager: c.trafficManager,
      metric: goal.metric, actual, target: goal.targetValue, attainment,
      status: attainment >= 1 ? ("healthy" as const) : ("risk" as const),
    };
  });
}

export type TrafficRow = {
  name: string;
  clients: number;
  metaHit?: number; // média de atingimento (%) — eficiência
  avgCpl: number;
  avgCtr: number;
  conversions: number; // absoluto
  revenue: number; // absoluto
};

export function buildTrafficRanking(
  clients: GavClient[],
  goals: ClientGoal[],
): TrafficRow[] {
  const health = buildHealth(clients, goals);
  const byManager = new Map<string, GavClient[]>();
  for (const c of clients) {
    byManager.set(c.trafficManager, [...(byManager.get(c.trafficManager) ?? []), c]);
  }
  const rows: TrafficRow[] = [];
  for (const [name, list] of byManager) {
    const attainments = list
      .map((c) => health.find((h) => h.id === c.id)?.attainment)
      .filter((a): a is number => typeof a === "number");
    const metaHit = attainments.length
      ? (attainments.reduce((s, a) => s + a, 0) / attainments.length) * 100
      : undefined;
    rows.push({
      name,
      clients: list.length,
      metaHit,
      avgCpl: list.reduce((s, c) => s + c.traffic.cpl, 0) / list.length,
      avgCtr: list.reduce((s, c) => s + c.traffic.ctr, 0) / list.length,
      conversions: list.reduce((s, c) => s + c.traffic.conversions, 0),
      revenue: list.reduce((s, c) => s + c.traffic.revenue, 0),
    });
  }
  // Ranking por EFICIÊNCIA (metaHit), não por absoluto (GAV02).
  return rows.sort((a, b) => (b.metaHit ?? -1) - (a.metaHit ?? -1));
}

// ── Lente Social (GAV03) ─────────────────────────────────────────────────────

export type SocialRow = {
  name: string;
  clients: number;
  engagementRate: number;
  commentRate: number;
  followersGrowth: number;
  engagement: number;
};

export function buildSocialRanking(clients: GavClient[]): SocialRow[] {
  const byAnalyst = new Map<string, GavClient[]>();
  for (const c of clients) {
    byAnalyst.set(c.socialAnalyst, [...(byAnalyst.get(c.socialAnalyst) ?? []), c]);
  }
  const rows: SocialRow[] = [];
  for (const [name, list] of byAnalyst) {
    rows.push({
      name,
      clients: list.length,
      engagementRate: list.reduce((s, c) => s + c.social.engagementRate, 0) / list.length,
      commentRate: list.reduce((s, c) => s + c.social.commentRate, 0) / list.length,
      followersGrowth: list.reduce((s, c) => s + c.social.followersGrowth, 0),
      engagement: list.reduce((s, c) => s + c.social.engagement, 0),
    });
  }
  return rows.sort((a, b) => b.engagementRate - a.engagementRate);
}

export function teamAverageSocial(rows: SocialRow[]) {
  const n = rows.length || 1;
  return {
    engagementRate: rows.reduce((s, r) => s + r.engagementRate, 0) / n,
    commentRate: rows.reduce((s, r) => s + r.commentRate, 0) / n,
    followersGrowth: Math.round(rows.reduce((s, r) => s + r.followersGrowth, 0) / n),
  };
}

// ── Lente Liderança (GAV04) ──────────────────────────────────────────────────

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  ecommerce: "E-commerce",
  lead_gen: "Geração de leads",
  local_business: "Negócio local",
};

export type SpecialtyRow = { type: ClientType; total: number; healthy: number; successRate: number };

export function buildSpecialty(clients: GavClient[], goals: ClientGoal[]): SpecialtyRow[] {
  const health = buildHealth(clients, goals);
  const types: ClientType[] = ["ecommerce", "lead_gen", "local_business"];
  return types.map((type) => {
    const inType = health.filter((h) => h.clientType === type);
    const withGoal = inType.filter((h) => h.status !== "no-goal");
    const healthy = inType.filter((h) => h.status === "healthy").length;
    return {
      type,
      total: inType.length,
      healthy,
      successRate: withGoal.length ? Math.round((healthy / withGoal.length) * 100) : 0,
    };
  });
}

export type FormatRow = { format: string; count: number };

export function buildFormatStrength(clients: GavClient[]): FormatRow[] {
  const map = new Map<string, number>();
  for (const c of clients) map.set(c.topFormat, (map.get(c.topFormat) ?? 0) + 1);
  return [...map.entries()]
    .map(([format, count]) => ({ format, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildAggregate(clients: GavClient[]) {
  return {
    revenue: clients.reduce((s, c) => s + c.traffic.revenue, 0),
    conversions: clients.reduce((s, c) => s + c.traffic.conversions, 0),
    spend: clients.reduce((s, c) => s + c.traffic.spend, 0),
    activeClients: clients.length,
  };
}

// ── Lentes / acesso (GAV01, GAV05) ───────────────────────────────────────────

export type Lens = "trafego" | "social" | "lideranca";

export const LENSES: { key: Lens; label: string; hint: string }[] = [
  { key: "trafego", label: "Tráfego", hint: "Performance de mídia paga por gestor" },
  { key: "social", label: "Social", hint: "Resultados orgânicos por analista" },
  { key: "lideranca", label: "Liderança", hint: "Vocação do time e agregado" },
];

/**
 * Lentes visíveis e visibilidade nominal, por cargo (team_role).
 * Liderança (gestor) vê tudo, nominal. Colaborador vê a sua lente, sem nomes
 * dos colegas (GAV05).
 */
export function lensAccess(teamRole: string | null | undefined, isFull: boolean): {
  lenses: Lens[];
  nominal: boolean;
  ownName?: string;
} {
  if (isFull || teamRole === "gestor" || !teamRole) {
    return { lenses: ["trafego", "social", "lideranca"], nominal: true };
  }
  if (teamRole === "trafego") return { lenses: ["trafego"], nominal: false };
  if (teamRole === "social") return { lenses: ["social"], nominal: false };
  // Demais cargos com acesso à página veem só a Liderança agregada (sem nomes).
  return { lenses: ["lideranca"], nominal: false };
}
