// Tipos e constantes da Agenda (client-safe — sem acesso a servidor).

export type RoutineBlock = {
  id: string;
  templateId?: string;
  ownerId?: string;
  title: string;
  weekday: number; // 0=dom … 6=sáb
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
  color: string;
  activityType?: string;
};

export type RoutineTemplate = {
  id: string;
  name: string;
  roleOrSquad?: string;
  isBase: boolean;
  ownerId?: string;
};

export type CalendarEvent = {
  id: string;
  ownerId?: string;
  title: string;
  type: string; // meeting|call|other
  startAt: string;
  endAt?: string;
  dealId?: string;
  googleEventId?: string;
};

/** Janela semanal de disponibilidade (day: 0=dom..6=sáb). */
export type AvailWindow = { day: number; start: string; end: string };

export type SchedulingLink = {
  id: string;
  url?: string | null; // link externo (Calendly de terceiros) — opcional
  label: string;
  active: boolean;
  // Agendador nativo:
  slug?: string | null;
  durationMin?: number;
  bufferMin?: number;
  daysAhead?: number;
  availability?: AvailWindow[];
};

const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (h || 0) * 60 + (m || 0);
};
const fromMin = (min: number): string =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Gera os horários candidatos de um dia (dateISO="YYYY-MM-DD") a partir das janelas. */
export function slotsForDate(
  avail: AvailWindow[],
  durationMin: number,
  bufferMin: number,
  dateISO: string,
): string[] {
  const dow = new Date(`${dateISO}T12:00:00`).getDay();
  const step = Math.max(5, durationMin + Math.max(0, bufferMin));
  const out: string[] = [];
  for (const w of avail.filter((x) => x.day === dow)) {
    const s = toMin(w.start);
    const e = toMin(w.end);
    for (let m = s; m + durationMin <= e; m += step) out.push(fromMin(m));
  }
  return out;
}

/** Tipos de atividade da rotina (alimentam o gráfico de tempo reservado). */
export const ROUTINE_ACTIVITIES: { key: string; label: string; color: string }[] = [
  { key: "prospeccao", label: "Prospecção", color: "#2a63c9" },
  { key: "followup", label: "Follow-ups", color: "#f59e0b" },
  { key: "reuniao", label: "Reuniões", color: "#10b981" },
  { key: "admin", label: "Admin", color: "#64748b" },
  { key: "criativo", label: "Criativo", color: "#8b5cf6" },
  { key: "livre", label: "Livre", color: "#94a3b8" },
];

export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Minutos desde 00:00 de um "HH:MM". */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Distribuição de tempo reservado por atividade (para o gráfico). */
export function timeReserved(blocks: RoutineBlock[]): { key: string; label: string; color: string; minutes: number; pct: number }[] {
  const byAct = new Map<string, number>();
  let total = 0;
  for (const b of blocks) {
    const mins = Math.max(0, minutesOf(b.endTime) - minutesOf(b.startTime));
    const act = b.activityType || "admin";
    byAct.set(act, (byAct.get(act) ?? 0) + mins);
    total += mins;
  }
  // "Livre" = o que sobra de uma semana útil de referência (5 dias × 8h).
  const workWeek = 5 * 8 * 60;
  const livre = Math.max(0, workWeek - total);
  const rows = ROUTINE_ACTIVITIES.map((a) => ({
    ...a,
    minutes: a.key === "livre" ? livre : byAct.get(a.key) ?? 0,
  })).filter((r) => r.minutes > 0);
  const grand = rows.reduce((s, r) => s + r.minutes, 0) || 1;
  return rows.map((r) => ({ ...r, pct: Math.round((r.minutes / grand) * 100) }));
}
