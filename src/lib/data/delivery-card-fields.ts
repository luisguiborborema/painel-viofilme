// Registry das propriedades exibíveis no card do Painel de Entregas.
// Serve tarefas editoriais E não-editoriais (site, e-commerce, ajustes…):
// nenhum campo é imposto — o usuário/equipe escolhe quais aparecem no card.
import {
  DELIVERY_PRIORITIES,
  OPS_TEAM,
  TASK_STAGES,
  ddmmFromIso,
  type DeliveryTask,
} from "./operacao";

export type CardFieldDef = { key: string; label: string; get: (t: DeliveryTask) => string };

const stageLabel = (k: string) => TASK_STAGES.find((s) => s.key === k)?.label ?? k;
const prioLabel = (k?: string) =>
  k ? DELIVERY_PRIORITIES.find((p) => p.key === k)?.label ?? "" : "";
const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;

export const DELIVERY_CARD_FIELDS: CardFieldDef[] = [
  { key: "client", label: "Cliente", get: (t) => t.client ?? "" },
  { key: "assignee", label: "Responsável", get: (t) => (t.assignee ? memberName(t.assignee) : "") },
  { key: "priority", label: "Prioridade", get: (t) => prioLabel(t.priority) },
  {
    key: "deliveryDate",
    label: "Prazo",
    get: (t) => (t.deliveryDate ? ddmmFromIso(t.deliveryDate) : t.dueDate ? ddmmFromIso(t.dueDate) : ""),
  },
  { key: "type", label: "Tipo", get: (t) => t.type ?? "" },
  { key: "stage", label: "Estágio", get: (t) => stageLabel(t.stage) },
  { key: "origin", label: "Origem", get: (t) => t.origin ?? "" },
  { key: "requester", label: "Solicitante", get: (t) => t.requester ?? "" },
  { key: "tema", label: "Tema", get: (t) => t.tema ?? "" },
  { key: "format", label: "Formato", get: (t) => t.contentFormat ?? "" },
];

export const CARD_FIELD_LABEL: Record<string, string> = Object.fromEntries(
  DELIVERY_CARD_FIELDS.map((f) => [f.key, f.label]),
);

export const DEFAULT_CARD_FIELDS = ["client", "priority", "type", "deliveryDate"];

const LS_KEY = "vio-delivery-card-fields";

/** Override do usuário (navegador), se houver. */
export function readUserCardFields(): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as string[]) : null;
  } catch {
    return null;
  }
}
export function writeUserCardFields(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(keys));
  } catch {
    /* ignore */
  }
}
export function clearUserCardFields(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    /* ignore */
  }
}
