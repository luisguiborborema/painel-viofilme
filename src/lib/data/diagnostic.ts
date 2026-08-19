/** Módulo Diagnóstico (comercial + entregas): questionário interno → documento. */

export type DiagnosticFieldType = "text" | "textarea" | "number" | "currency" | "choice";

export type DiagnosticQuestion = {
  id: string;
  label: string;
  type: DiagnosticFieldType;
  options: string[]; // usado quando type === "choice"
  hint: string;
};

export type DiagnosticConfig = {
  questions: DiagnosticQuestion[];
};

/** Template inicial (diagnóstico comercial). Editável na tela de config. */
export const DIAGNOSTIC_DEFAULTS: DiagnosticQuestion[] = [
  { id: "faturamento", label: "Faturamento médio mensal", type: "currency", options: [], hint: "Quanto a empresa fatura por mês hoje" },
  { id: "ticket", label: "Ticket médio", type: "currency", options: [], hint: "Valor médio por venda/cliente" },
  { id: "leads_mes", label: "Leads recebidos por mês", type: "number", options: [], hint: "" },
  { id: "conversao", label: "Taxa de conversão atual (%)", type: "number", options: [], hint: "Dos leads, quantos viram venda" },
  { id: "perda", label: "Quanto está deixando de ganhar por mês (estimativa)", type: "currency", options: [], hint: "Oportunidade perdida hoje" },
  { id: "canais", label: "Principais canais de aquisição hoje", type: "textarea", options: [], hint: "" },
  { id: "gargalo", label: "Maior gargalo hoje", type: "textarea", options: [], hint: "O que mais trava o crescimento" },
  { id: "invest_mkt", label: "Investimento atual em marketing (R$/mês)", type: "currency", options: [], hint: "" },
  { id: "meta", label: "Meta de crescimento (%)", type: "number", options: [], hint: "" },
  { id: "objetivo", label: "Objetivo principal com a Viofilme", type: "textarea", options: [], hint: "" },
];

const TYPES = new Set<DiagnosticFieldType>(["text", "textarea", "number", "currency", "choice"]);

/** Sanitiza/valida a lista de perguntas (do banco ou do editor). */
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

export function toDiagnosticConfig(row: { questions?: unknown } | null | undefined): DiagnosticConfig {
  const qs = parseDiagnosticQuestions(row?.questions);
  return { questions: qs.length ? qs : DIAGNOSTIC_DEFAULTS };
}

/** Resposta gravada (mapa id → valor). */
export type DiagnosticAnswers = Record<string, string>;

/** Um diagnóstico (instância preenchida). */
export type Diagnostic = {
  id: string;
  clientId: string | null;
  leadId: string | null;
  subject: string; // nome do cliente/empresa (denormalizado p/ exibição)
  title: string;
  answers: DiagnosticAnswers;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

/** Item de lista (sem answers pesado). */
export type DiagnosticListItem = {
  id: string;
  subject: string;
  title: string;
  clientId: string | null;
  leadId: string | null;
  createdAt: string;
};
