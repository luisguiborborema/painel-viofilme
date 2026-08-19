/**
 * Disparos em massa (WhatsApp). Client-safe: só tipos e helpers puros.
 * Leituras reais em broadcasts-server.ts; escritas em /api/gerencial/broadcasts.
 */

export type BroadcastStatus = "draft" | "scheduled" | "sending" | "done" | "paused" | "canceled";
export type BroadcastMediaType = "image" | "video" | "document";
/** Tipo da mensagem (aba do compositor). 'text' não leva mídia. */
export type BroadcastMsgType = "text" | "image" | "video" | "audio" | "document";
export type RecipientKind = "number" | "group";
export type RecipientStatus = "pending" | "sent" | "failed" | "skipped";

export const MSG_TYPES: { key: BroadcastMsgType; label: string }[] = [
  { key: "text", label: "Texto" },
  { key: "image", label: "Imagem" },
  { key: "video", label: "Vídeo" },
  { key: "audio", label: "Áudio" },
];

export type Broadcast = {
  id: string;
  title: string;
  message: string;
  msgType: BroadcastMsgType;
  mediaUrl?: string | null;
  mediaType?: BroadcastMediaType | null;
  instanceToken?: string | null;
  instanceName?: string | null;
  delayMin: number;
  delayMax: number;
  aiRewrite: boolean;
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
  /** Amostra do 1º erro (só na listagem, para o card do Histórico). */
  errorSample?: string | null;
};

export type BroadcastRecipient = {
  id: string;
  kind: RecipientKind;
  target: string;
  name?: string;
  vars?: Record<string, string>;
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
  { key: "canceled", label: "Cancelado", tone: "bg-rose-500/15 text-rose-600" },
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

/**
 * Substitui {nome}/{primeiro_nome} e cada variável de planilha ({empresa}, …).
 * Variáveis desconhecidas viram string vazia (não deixa "{x}" na mensagem).
 */
export function personalize(message: string, name?: string, vars?: Record<string, string>): string {
  const full = (name ?? "").trim();
  const first = full.split(/\s+/)[0] ?? "";
  const map: Record<string, string> = {};
  for (const [k, v] of Object.entries(vars ?? {})) map[k.toLowerCase().trim()] = String(v ?? "");
  if (full) {
    map.nome = map.nome || full;
    map.primeiro_nome = map.primeiro_nome || first;
  }
  return message.replace(/\{([\w.-]+)\}/g, (_, key: string) => {
    const k = key.toLowerCase().trim();
    if (k in map) return map[k];
    if (k === "nome" || k === "primeiro_nome") return "tudo bem";
    return "";
  });
}

/** É um JID de grupo do WhatsApp? (…@g.us) */
export function isGroupTarget(target: string): boolean {
  return target.includes("@g.us") || (target.includes("@") && target.includes("-"));
}

/** Agrupa uma mensagem de erro crua num motivo legível (painel de Entrega). */
export function errorReason(error?: string | null): string {
  const e = (error ?? "").toLowerCase();
  if (!e) return "Outro";
  if (/not on whatsapp|not-whatsapp|não está no whatsapp|invalid.*number|número inválido/.test(e)) return "Número não está no WhatsApp";
  if (/disconnec|not connected|desconect|offline|instance.*(not|closed)|logged out|unauthorized|401|403/.test(e)) return "WhatsApp desconectado";
  if (/timeout|abort/.test(e)) return "Timeout";
  if (/not.*(in|member).*group|fora do grupo|participant|group.*not/.test(e)) return "Fora do grupo";
  if (/uazapi_5|_50\d|\b50\d\b|server error|internal/.test(e)) return "Erro do servidor (5xx)";
  if (/uazapi_4|\b40\d\b|bad request/.test(e)) return "Requisição inválida (4xx)";
  if (/mídia|media|file/.test(e)) return "Falha de mídia";
  if (/não configurado/.test(e)) return "WhatsApp não configurado";
  return "Outro";
}

/** Normaliza um número colado (mantém só dígitos; assume DDI 55 se faltar). */
export function cleanNumber(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  // 10–11 dígitos = número BR sem DDI → prefixa 55.
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

/** Parseia uma lista colada (linhas, vírgulas ou ponto-e-vírgula) em números OU JIDs de grupo. */
export function parseNumberList(raw: string): { numbers: string[]; groups: string[] } {
  const seenN = new Set<string>();
  const seenG = new Set<string>();
  const numbers: string[] = [];
  const groups: string[] = [];
  for (const part of (raw ?? "").split(/[\n,;]+/)) {
    const t = part.trim();
    if (!t) continue;
    if (t.includes("@") || /g\.us$/i.test(t)) {
      const jid = t.includes("@") ? t : `${t}@g.us`;
      if (!seenG.has(jid)) { seenG.add(jid); groups.push(jid); }
      continue;
    }
    const n = cleanNumber(t);
    if (n.length >= 12 && !seenN.has(n)) { seenN.add(n); numbers.push(n); }
  }
  return { numbers, groups };
}

/** Milissegundos aleatórios em [min,max] segundos (anti-ban). */
export function randomDelayMs(minSec: number, maxSec: number): number {
  const lo = Math.max(0, Math.min(minSec, maxSec));
  const hi = Math.max(minSec, maxSec);
  return Math.round((lo + Math.random() * (hi - lo)) * 1000);
}

/** CSV modelo para "Baixar modelo". 1ª coluna = número; demais viram variáveis. */
export const SHEET_TEMPLATE = "numero,nome,empresa\n5527999998888,Maria,Loja da Maria\n5531988887777,João,Auto Center JP\n";

export type SheetRecipient = { target: string; name: string; vars: Record<string, string> };

/**
 * Converte uma matriz (planilha CSV/XLSX) em destinatários. A 1ª linha são
 * cabeçalhos; a 1ª coluna é o número; demais colunas viram variáveis {cabecalho}.
 * Uma coluna chamada "nome" também alimenta a personalização {nome}.
 */
export function sheetToRecipients(rows: unknown[][]): { headers: string[]; recipients: SheetRecipient[] } {
  if (!rows || rows.length < 2) return { headers: [], recipients: [] };
  const headers = (rows[0] ?? []).map((h) => String(h ?? "").trim());
  const nameIdx = headers.findIndex((h) => h.toLowerCase() === "nome");
  const seen = new Set<string>();
  const recipients: SheetRecipient[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const target = cleanNumber(String(row[0] ?? ""));
    if (target.length < 12 || seen.has(target)) continue;
    seen.add(target);
    const vars: Record<string, string> = {};
    for (let c = 1; c < headers.length; c++) {
      const key = headers[c];
      if (key) vars[key] = String(row[c] ?? "").trim();
    }
    recipients.push({ target, name: nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() : "", vars });
  }
  return { headers: headers.filter(Boolean), recipients };
}
