/**
 * Central de Relatórios — updates recorrentes (REL01–REL06). Client-safe:
 * tipos, opções, helpers de recorrência e resolver de valor (mock determinístico
 * até a integração Meta acender). O disparo real fica no cron; a UI em
 * relatorios. Envio via Uazapi (texto livre — número conectado, sem template
 * oficial da Meta nesta fase).
 */
import { formatCompact, formatNumber } from "@/lib/utils";

export type UpdateMetric = "followers_growth" | "reach" | "engagement" | "conversions";

export const UPDATE_METRICS: { key: UpdateMetric; label: string; short: string }[] = [
  { key: "followers_growth", label: "Seguidores (crescimento)", short: "seguidores" },
  { key: "reach", label: "Alcance", short: "alcance" },
  { key: "engagement", label: "Engajamento", short: "engajamento" },
  { key: "conversions", label: "Leads / Conversões", short: "leads" },
];

export function metricLabel(key: UpdateMetric): string {
  return UPDATE_METRICS.find((m) => m.key === key)?.label ?? key;
}

// ── Recorrência ──────────────────────────────────────────────────────────────

export const WEEKDAYS = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
];

export type RecurrenceKind = "daily" | "weekly" | "monthly";

export function parseRecurrence(r: string): { kind: RecurrenceKind; value: number } {
  if (r.startsWith("weekly:")) return { kind: "weekly", value: Number(r.split(":")[1]) };
  if (r.startsWith("monthly:")) return { kind: "monthly", value: Number(r.split(":")[1]) };
  return { kind: "daily", value: 0 };
}

export function recurrenceLabel(r: string): string {
  const p = parseRecurrence(r);
  if (p.kind === "daily") return "Todo dia";
  if (p.kind === "weekly") return `Toda ${WEEKDAYS[p.value] ?? "semana"}`;
  return `Todo dia ${p.value} do mês`;
}

/** O update deve disparar nesta data (UTC)? */
export function isDue(r: string, date: Date): boolean {
  const p = parseRecurrence(r);
  if (p.kind === "daily") return true;
  if (p.kind === "weekly") return date.getUTCDay() === p.value;
  return date.getUTCDate() === p.value;
}

// ── Update (config) ──────────────────────────────────────────────────────────

export type RecurringUpdate = {
  id: string;
  clientId: string;
  clientName?: string;
  metrics: UpdateMetric[];
  recurrence: string;
  channel: string;
  recipient: string;
  status: "active" | "paused";
  lastSentAt?: string;
  createdBy?: string;
};

// ── Resolver de valor (mock determinístico por cliente+métrica) ──────────────

function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Valor mock estável (até a Meta acender) para um cliente+métrica. */
export function resolveMetricValue(
  clientId: string,
  metric: UpdateMetric,
): { value: number; formatted: string; variation: string } {
  let s = seed(clientId + ":" + metric);
  s = (s + 0x6d2b79f5) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;

  switch (metric) {
    case "followers_growth": {
      const v = 80 + Math.round(rand * 900);
      return { value: v, formatted: `+${formatNumber(v)}`, variation: `+${(4 + rand * 12).toFixed(0)}%` };
    }
    case "reach": {
      const v = 20000 + Math.round(rand * 180000);
      return { value: v, formatted: formatCompact(v), variation: `+${(3 + rand * 20).toFixed(0)}%` };
    }
    case "engagement": {
      const v = Math.round((2 + rand * 6) * 10) / 10;
      return { value: v, formatted: `${v.toFixed(1)}%`, variation: `+${(1 + rand * 8).toFixed(0)}%` };
    }
    case "conversions": {
      const v = 20 + Math.round(rand * 400);
      return { value: v, formatted: formatNumber(v), variation: `+${(2 + rand * 15).toFixed(0)}%` };
    }
  }
}

/** Mensagem (texto livre) do update para o WhatsApp do cliente. */
export function buildUpdateMessage(
  clientName: string,
  clientId: string,
  metrics: UpdateMetric[],
): string {
  const lines = metrics.map((m) => {
    const r = resolveMetricValue(clientId, m);
    return `• ${metricLabel(m)}: *${r.formatted}* (${r.variation})`;
  });
  return [
    `Olá! 👋 Resumo de ${clientName} — Viofilme:`,
    "",
    ...lines,
    "",
    "Qualquer dúvida, é só chamar por aqui. 🚀",
  ].join("\n");
}
