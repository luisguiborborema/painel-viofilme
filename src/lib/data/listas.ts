// Listas (banco de dados comercial) — camada de dados de Pessoas e Empresas.
// Reaproveita Contact/Company (crm_contacts/crm_companies) e deriva contadores
// de negócios (abertos/ganhos) e próxima atividade a partir de crm_leads/crm_tasks.
// O motor de campos (FieldDef) serve a três coisas ao mesmo tempo: colunas da
// tabela, condições empilháveis e visões salvas.

import type { Company, Contact, CrmLead, TaskItem } from "./crm";
import { isOpenLead } from "./crm";

// ── Linhas derivadas ─────────────────────────────────────────────────────────
export type PersonRow = {
  id: string;
  name: string;
  title?: string;
  company: string;
  companyId?: string;
  email?: string;
  phone?: string;
  owner?: string;
  tags: string[];
  segment?: string;
  city?: string;
  open: number; // negócios em aberto
  won: number; // negócios ganhos
  nextActivity?: string; // ISO da próxima atividade pendente
  hasDeal: boolean;
  createdAt: string;
};

export type CompanyRow = {
  id: string;
  name: string;
  segment?: string;
  city?: string;
  website?: string;
  phone?: string;
  email?: string;
  owner?: string;
  tags: string[];
  cnpj?: string;
  instagram?: string;
  people: number; // qtd de contatos
  open: number;
  won: number;
  nextActivity?: string;
  hasDeal: boolean;
  createdAt: string;
};

// ── Condições / visões ───────────────────────────────────────────────────────
export type Condition = { field: string; op: ConditionOp; value: string };
export type ConditionOp = "contem" | "eh" | "maior" | "menor" | "vazio" | "preenchido";
export type Lens = "todos" | "com_negocio" | "sem_negocio";

export type SavedView = {
  id: string;
  scope: "pessoas" | "empresas";
  name: string;
  conditions: Condition[];
  lens?: Lens | null;
  isShared: boolean;
};

export const CONDITION_OPS: { value: ConditionOp; label: string; forType: ("text" | "number")[] }[] = [
  { value: "contem", label: "contém", forType: ["text"] },
  { value: "eh", label: "é", forType: ["text", "number"] },
  { value: "maior", label: "maior que", forType: ["number"] },
  { value: "menor", label: "menor que", forType: ["number"] },
  { value: "preenchido", label: "está preenchido", forType: ["text", "number"] },
  { value: "vazio", label: "está vazio", forType: ["text", "number"] },
];

// ── Motor de campos (colunas + condições compartilham a mesma definição) ─────
export type FieldType = "text" | "number";
export type FieldDef<T> = {
  key: string;
  label: string;
  type: FieldType;
  get: (row: T) => string | number | string[] | undefined;
};

export const PERSON_FIELDS: FieldDef<PersonRow>[] = [
  { key: "name", label: "Nome", type: "text", get: (r) => r.name },
  { key: "company", label: "Empresa", type: "text", get: (r) => r.company },
  { key: "title", label: "Cargo", type: "text", get: (r) => r.title },
  { key: "email", label: "E-mail", type: "text", get: (r) => r.email },
  { key: "phone", label: "Telefone", type: "text", get: (r) => r.phone },
  { key: "owner", label: "Responsável", type: "text", get: (r) => r.owner },
  { key: "segment", label: "Segmento", type: "text", get: (r) => r.segment },
  { key: "city", label: "Cidade", type: "text", get: (r) => r.city },
  { key: "tags", label: "Tags", type: "text", get: (r) => r.tags },
  { key: "open", label: "Negócios em aberto", type: "number", get: (r) => r.open },
  { key: "won", label: "Negócios ganhos", type: "number", get: (r) => r.won },
];

export const COMPANY_FIELDS: FieldDef<CompanyRow>[] = [
  { key: "name", label: "Empresa", type: "text", get: (r) => r.name },
  { key: "segment", label: "Segmento", type: "text", get: (r) => r.segment },
  { key: "city", label: "Cidade", type: "text", get: (r) => r.city },
  { key: "owner", label: "Responsável", type: "text", get: (r) => r.owner },
  { key: "cnpj", label: "CNPJ", type: "text", get: (r) => r.cnpj },
  { key: "website", label: "Site", type: "text", get: (r) => r.website },
  { key: "tags", label: "Tags", type: "text", get: (r) => r.tags },
  { key: "people", label: "Pessoas", type: "number", get: (r) => r.people },
  { key: "open", label: "Negócios em aberto", type: "number", get: (r) => r.open },
  { key: "won", label: "Negócios ganhos", type: "number", get: (r) => r.won },
];

// ── Builders ─────────────────────────────────────────────────────────────────
function isWon(l: CrmLead): boolean {
  return l.stage === "ganho";
}

/** Menor due-date pendente por lead (base da "próxima atividade"). */
function nextDueByLead(tasks: TaskItem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const t of tasks) {
    if (t.status !== "pending" || !t.dueDate || !t.leadId) continue;
    const cur = m.get(t.leadId);
    if (!cur || t.dueDate < cur) m.set(t.leadId, t.dueDate);
  }
  return m;
}

function minDate(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

export function buildPersonRows(
  contacts: Contact[],
  companies: Company[],
  deals: CrmLead[],
  tasks: TaskItem[],
): PersonRow[] {
  const companyById = new Map(companies.map((c) => [c.id, c]));
  const dueByLead = nextDueByLead(tasks);
  const byContact = new Map<string, CrmLead[]>();
  for (const d of deals) {
    if (!d.primaryContactId) continue;
    const arr = byContact.get(d.primaryContactId) ?? [];
    arr.push(d);
    byContact.set(d.primaryContactId, arr);
  }
  return contacts.map((ct) => {
    const co = ct.companyId ? companyById.get(ct.companyId) : undefined;
    const mine = byContact.get(ct.id) ?? [];
    let open = 0;
    let won = 0;
    let next: string | undefined;
    for (const d of mine) {
      if (isOpenLead(d)) open += 1;
      if (isWon(d)) won += 1;
      next = minDate(next, dueByLead.get(d.id));
    }
    return {
      id: ct.id,
      name: ct.name,
      title: ct.title,
      company: co?.name ?? "",
      companyId: ct.companyId,
      email: ct.email,
      phone: ct.phone,
      owner: ct.owner,
      tags: ct.tags ?? [],
      segment: co?.segment,
      city: co?.city,
      open,
      won,
      nextActivity: next,
      hasDeal: mine.length > 0,
      createdAt: ct.createdAt,
    };
  });
}

export function buildCompanyRows(
  companies: Company[],
  contacts: Contact[],
  deals: CrmLead[],
  tasks: TaskItem[],
): CompanyRow[] {
  const dueByLead = nextDueByLead(tasks);
  const peopleCount = new Map<string, number>();
  for (const ct of contacts) {
    if (!ct.companyId) continue;
    peopleCount.set(ct.companyId, (peopleCount.get(ct.companyId) ?? 0) + 1);
  }
  const byCompany = new Map<string, CrmLead[]>();
  for (const d of deals) {
    if (!d.companyId) continue;
    const arr = byCompany.get(d.companyId) ?? [];
    arr.push(d);
    byCompany.set(d.companyId, arr);
  }
  return companies.map((co) => {
    const mine = byCompany.get(co.id) ?? [];
    let open = 0;
    let won = 0;
    let next: string | undefined;
    for (const d of mine) {
      if (isOpenLead(d)) open += 1;
      if (isWon(d)) won += 1;
      next = minDate(next, dueByLead.get(d.id));
    }
    const props = co.properties ?? {};
    return {
      id: co.id,
      name: co.name,
      segment: co.segment,
      city: co.city,
      website: co.website,
      phone: co.phone,
      email: co.email,
      owner: co.owner,
      tags: co.tags ?? [],
      cnpj: typeof props.cnpj === "string" ? props.cnpj : undefined,
      instagram: typeof props.instagram === "string" ? props.instagram : undefined,
      people: peopleCount.get(co.id) ?? 0,
      open,
      won,
      nextActivity: next,
      hasDeal: mine.length > 0,
      createdAt: co.createdAt,
    };
  });
}

// ── Filtro (condições + lente com/sem negócio + busca) ───────────────────────
function fieldAsString(v: string | number | string[] | undefined): string {
  if (v == null) return "";
  if (Array.isArray(v)) return v.join(" ");
  return String(v);
}

function matchCondition<T>(row: T, cond: Condition, fields: FieldDef<T>[]): boolean {
  const def = fields.find((f) => f.key === cond.field);
  if (!def) return true;
  const raw = def.get(row);
  const asStr = fieldAsString(raw).toLowerCase();
  const val = cond.value.trim().toLowerCase();
  switch (cond.op) {
    case "vazio":
      return asStr === "" || asStr === "0";
    case "preenchido":
      return asStr !== "" && asStr !== "0";
    case "contem":
      return asStr.includes(val);
    case "eh":
      return def.type === "number" ? Number(raw) === Number(cond.value) : asStr === val;
    case "maior":
      return Number(raw) > Number(cond.value);
    case "menor":
      return Number(raw) < Number(cond.value);
    default:
      return true;
  }
}

export function applyConditions<T>(rows: T[], conditions: Condition[], fields: FieldDef<T>[]): T[] {
  const active = conditions.filter((c) => c.field && (c.op === "vazio" || c.op === "preenchido" || c.value.trim() !== ""));
  if (!active.length) return rows;
  return rows.filter((r) => active.every((c) => matchCondition(r, c, fields)));
}

export function applyLens<T extends { hasDeal: boolean }>(rows: T[], lens: Lens): T[] {
  if (lens === "com_negocio") return rows.filter((r) => r.hasDeal);
  if (lens === "sem_negocio") return rows.filter((r) => !r.hasDeal);
  return rows;
}
