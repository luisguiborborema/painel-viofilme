/** Módulo Diagnóstico (comercial + entregas): questionário interno → documento. */

export type DiagnosticFieldType = "text" | "textarea" | "number" | "currency" | "choice";

export type DiagnosticQuestion = {
  id: string;
  label: string;
  type: DiagnosticFieldType;
  options: string[]; // usado quando type === "choice"
  hint: string;
};

export type ComputedFormat = "number" | "currency" | "percent";

/** Campo calculado a partir das respostas (fórmula sobre ids de perguntas). */
export type DiagnosticComputed = {
  id: string;
  label: string;
  formula: string; // ex.: leads_mes * (1 - conversao/100) * ticket
  format: ComputedFormat;
};

export type DiagnosticArea = "comercial" | "entregas" | "outro";

export type DiagnosticTemplate = {
  id: string;
  name: string;
  area: DiagnosticArea;
  questions: DiagnosticQuestion[];
  computed: DiagnosticComputed[];
  position: number;
};

const TYPES = new Set<DiagnosticFieldType>(["text", "textarea", "number", "currency", "choice"]);
const FORMATS = new Set<ComputedFormat>(["number", "currency", "percent"]);

export function parseDiagnosticQuestions(raw: unknown): DiagnosticQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((q, i): DiagnosticQuestion | null => {
      if (!q || typeof q !== "object") return null;
      const o = q as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      if (!label) return null;
      const type = TYPES.has(o.type as DiagnosticFieldType) ? (o.type as DiagnosticFieldType) : "text";
      const options =
        type === "choice" && Array.isArray(o.options)
          ? o.options.map((x) => String(x).trim()).filter(Boolean).slice(0, 20)
          : [];
      return { id: String(o.id ?? `q${i + 1}`), label, type, options, hint: String(o.hint ?? "").trim() };
    })
    .filter((q): q is DiagnosticQuestion => q !== null)
    .slice(0, 60);
}

export function parseComputed(raw: unknown): DiagnosticComputed[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c, i): DiagnosticComputed | null => {
      if (!c || typeof c !== "object") return null;
      const o = c as Record<string, unknown>;
      const label = String(o.label ?? "").trim();
      const formula = String(o.formula ?? "").trim();
      if (!label || !formula) return null;
      const format = FORMATS.has(o.format as ComputedFormat) ? (o.format as ComputedFormat) : "number";
      return { id: String(o.id ?? `c${i + 1}`), label, formula, format };
    })
    .filter((c): c is DiagnosticComputed => c !== null)
    .slice(0, 20);
}

const AREAS = new Set<DiagnosticArea>(["comercial", "entregas", "outro"]);

export function toTemplate(row: {
  id?: unknown;
  name?: unknown;
  area?: unknown;
  questions?: unknown;
  computed?: unknown;
  position?: unknown;
} | null | undefined): DiagnosticTemplate | null {
  if (!row?.id) return null;
  return {
    id: String(row.id),
    name: String(row.name ?? "Diagnóstico").trim() || "Diagnóstico",
    area: AREAS.has(row.area as DiagnosticArea) ? (row.area as DiagnosticArea) : "comercial",
    questions: parseDiagnosticQuestions(row.questions),
    computed: parseComputed(row.computed),
    position: Number(row.position ?? 0),
  };
}

/**
 * Avaliador seguro de fórmula (sem eval): + - * / ( ), números e variáveis
 * (ids de perguntas). Divisão por zero → 0. Retorna null se inválida.
 */
export function evalFormula(formula: string, vars: Record<string, number>): number | null {
  const tokens = formula.match(/\d+\.?\d*|[A-Za-z_]\w*|[+\-*/()]/g);
  if (!tokens || tokens.length === 0) return null;
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function factor(): number {
    const t = next();
    if (t === "(") {
      const v = expr();
      if (peek() === ")") next();
      return v;
    }
    if (t === "-") return -factor();
    if (t === "+") return factor();
    if (/^\d/.test(t)) return Number(t);
    return Number(vars[t] ?? 0);
  }
  function term(): number {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = factor();
      v = op === "*" ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  }
  function expr(): number {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  try {
    const result = expr();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** Converte uma resposta (texto) num número para as fórmulas. */
export function answerToNumber(v: string | undefined): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Formata o resultado de um campo calculado. */
export function formatComputed(value: number, format: ComputedFormat): string {
  if (format === "currency") return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  if (format === "percent") return `${(Math.round(value * 10) / 10).toLocaleString("pt-BR")}%`;
  return (Math.round(value * 100) / 100).toLocaleString("pt-BR");
}

// --- Instâncias -------------------------------------------------------------
export type DiagnosticAnswers = Record<string, string>;

export type Diagnostic = {
  id: string;
  templateId: string | null;
  clientId: string | null;
  leadId: string | null;
  subject: string;
  title: string;
  answers: DiagnosticAnswers;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type DiagnosticListItem = {
  id: string;
  subject: string;
  title: string;
  clientId: string | null;
  leadId: string | null;
  templateName: string;
  createdAt: string;
};
