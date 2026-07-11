/**
 * Atendimento — inbox WhatsApp multi-atendente (estilo Kommo).
 *
 * Client-safe: só tipos e mock. Leituras reais em supabase.ts (funções sb*) e
 * delegação em queries.ts. Escritas em /api/inbox/*.
 */
import { REFERENCE_DATE } from "./mock";

export type WaStatus = "open" | "pending" | "closed";

export const WA_STATUS: { key: WaStatus; label: string }[] = [
  { key: "open", label: "Abertas" },
  { key: "pending", label: "Pendentes" },
  { key: "closed", label: "Resolvidas" },
];

export type WaConversation = {
  id: string;
  phone: string;
  name?: string;
  leadId?: string;
  assignedTo?: string;
  assignedName?: string;
  status: WaStatus;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  lastDirection?: "in" | "out";
  unreadCount: number;
  updatedAt: string;
};

export type WaMessage = {
  id: string;
  conversationId: string;
  direction: "in" | "out";
  type: "text" | "audio" | "image" | "video" | "document";
  body?: string;
  mediaUrl?: string;
  author?: string;
  status?: string;
  createdAt: string;
};

export type Attendant = { id: string; name: string; avatarUrl?: string };

/** Nome de exibição da conversa (nome do contato ou o telefone formatado). */
export function conversationTitle(c: WaConversation): string {
  if (c.name?.trim()) return c.name;
  return formatPhone(c.phone);
}

/** "+55 27 99999-8888" a partir dos dígitos. */
export function formatPhone(digits: string): string {
  const d = (digits ?? "").replace(/\D/g, "");
  if (d.length < 12) return digits;
  const ddi = d.slice(0, 2);
  const ddd = d.slice(2, 4);
  const rest = d.slice(4);
  const mid = rest.length > 8 ? rest.slice(0, 5) : rest.slice(0, 4);
  const end = rest.length > 8 ? rest.slice(5) : rest.slice(4);
  return `+${ddi} ${ddd} ${mid}-${end}`;
}

// ── Mock (fallback demo) ─────────────────────────────────────────────────────

function iso(daysOffset: number, hour = 12, min = 0): string {
  const d = new Date(REFERENCE_DATE);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  d.setUTCHours(hour, min, 0, 0);
  return d.toISOString();
}

export const MOCK_CONVERSATIONS: WaConversation[] = [
  {
    id: "conv-costamar", phone: "5527999924567", name: "Pedro Costa",
    leadId: "lead-costamar", assignedName: "Ana Lima", status: "open",
    lastMessageAt: iso(0, 11), lastMessagePreview: "Recebi a proposta, gostei! Quer fechar.",
    lastDirection: "in", unreadCount: 1, updatedAt: iso(0, 11),
  },
  {
    id: "conv-bela", phone: "5527999990003", name: "Camila Souza",
    leadId: "lead-bela", assignedName: "Marcos Silva", status: "pending",
    lastMessageAt: iso(-1, 16), lastMessagePreview: "Perfeito, confirmo a reunião amanhã.",
    lastDirection: "in", unreadCount: 0, updatedAt: iso(-1, 16),
  },
  {
    id: "conv-novo", phone: "5531988887777", name: "Contato novo",
    status: "open", lastMessageAt: iso(0, 9), lastMessagePreview: "Olá, vocês fazem gestão de tráfego?",
    lastDirection: "in", unreadCount: 2, updatedAt: iso(0, 9),
  },
];

export const MOCK_MESSAGES: Record<string, WaMessage[]> = {
  "conv-costamar": [
    { id: "m1", conversationId: "conv-costamar", direction: "out", type: "text", author: "Ana Lima", body: "Olá Pedro! Segue a proposta da Costa Mar 😊", createdAt: iso(-5, 9) },
    { id: "m2", conversationId: "conv-costamar", direction: "in", type: "text", body: "Recebi a proposta, gostei! Quer fechar.", createdAt: iso(0, 11) },
  ],
  "conv-bela": [
    { id: "m3", conversationId: "conv-bela", direction: "out", type: "text", author: "Marcos Silva", body: "Oi Camila, podemos marcar a reunião de descoberta?", createdAt: iso(-1, 15) },
    { id: "m4", conversationId: "conv-bela", direction: "in", type: "text", body: "Perfeito, confirmo a reunião amanhã.", createdAt: iso(-1, 16) },
  ],
  "conv-novo": [
    { id: "m5", conversationId: "conv-novo", direction: "in", type: "text", body: "Olá, vocês fazem gestão de tráfego?", createdAt: iso(0, 9) },
  ],
};

export const MOCK_ATTENDANTS: Attendant[] = [
  { id: "att-ana", name: "Ana Lima" },
  { id: "att-marcos", name: "Marcos Silva" },
];
