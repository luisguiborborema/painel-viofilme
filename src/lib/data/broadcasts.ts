/**
 * Disparos em massa (WhatsApp). Client-safe: só tipos e helpers puros.
 * Leituras reais em broadcasts-server.ts; escritas em /api/gerencial/broadcasts.
 */

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "done" | "paused";
export type BroadcastMediaType = "image" | "video" | "document";
export type RecipientKind = "number" | "group";
export type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

export type Broadcast = {
  id: string;
  title: string;
  message: string;
  mediaUrl?: string | null;
  mediaType?: BroadcastMediaType | null;
  delaySeconds: number;
  status: BroadcastStatus;
  scheduledFor?: string | null;
  total: number;
  sent: number;
  failed: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
};

export type BroadcastRecipient = {
  id: string;
  kind: RecipientKind;
  target: string;
  name?: string;
  status: RecipientStatus;
  error?: string | null;
  sentAt?: string | null;
};

export type BroadcastDetail = Broadcast & { recipients: BroadcastRecipient[] };

export const BROADCAST_STATUS: { key: BroadcastStatus; label: string; tone: string }[] = [
  { key: "draft", label: "Rascunho", tone: "bg-subtle text-muted" },
  { key: "scheduled", label: "Agendado", tone: "bg-amber-500/15 text-amber-600" },
  { key: "sending", label: "Enviando", tone: "bg-blue-500/15 text-blue-600" },
  { key: "done", label: "Concluído", tone: "bg-emerald-500/15 text-emerald-600" },
  { key: "paused", label: "Pausado", tone: "bg-orange-500/15 text-orange-600" },
];

export function statusLabel(s: BroadcastStatus): string {
  return BROADCAST_STATUS.find((x) => x.key === s)?.label ?? s;
}
export function statusTone(s: BroadcastStatus): string {
  return BROADCAST_STATUS.find((x) => x.key === s)?.tone ?? "bg-subtle text-muted";
}

/** Progresso 0..100 (processados / total). */
export function broadcastProgress(b: Pick<Broadcast, "total" | "sent" | "failed">): number {
  if (b.total <= 0) return 0;
  return Math.min(100, Math.round(((b.sent + b.failed) / b.total) * 100));
}

/** Substitui {nome} / {primeiro_nome} pela pessoa/grupo do destinatário. */
export function personalize(message: string, name?: string): string {
  const full = (name ?? "").trim();
  const first = full.split(/\s+/)[0] ?? "";
  return message
    .replace(/\{nome\}/gi, full || "tudo bem")
    .replace(/\{primeiro_nome\}/gi, first || "tudo bem");
}

/** É um JID de grupo do WhatsApp? (…@g.us) */
export function isGroupTarget(target: string): boolean {
  return target.includes("@g.us") || (target.includes("@") && target.includes("-"));
}

/** Normaliza um número colado (mantém só dígitos; assume DDI 55 se faltar). */
export function cleanNumber(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  // 10–11 dígitos = número BR sem DDI → prefixa 55.
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

/** Parseia uma lista colada (linhas, vírgulas ou ponto-e-vírgula) em números. */
export function parseNumberList(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of (raw ?? "").split(/[\n,;]+/)) {
    const n = cleanNumber(part);
    if (n.length >= 12 && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}
