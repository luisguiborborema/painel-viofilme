"use client";

import Link from "next/link";
import { ArrowLeft, Printer, Sparkles } from "lucide-react";
import { answerToNumber, evalFormula, formatComputed, type Diagnostic, type DiagnosticQuestion, type DiagnosticTemplate } from "@/lib/data/diagnostic";

function fmtValue(q: DiagnosticQuestion, raw: string): string {
  const v = (raw ?? "").trim();
  if (!v) return "—";
  if (q.type === "currency") {
    const n = Number(v.replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", "."));
    if (Number.isFinite(n) && v.match(/\d/)) return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
  if (q.type === "number") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n) && !v.match(/[a-zA-Z]/)) return n.toLocaleString("pt-BR");
  }
  return v;
}

export function DiagnosticDoc({ diagnostic, template }: { diagnostic: Diagnostic; template: DiagnosticTemplate | null }) {
  const date = diagnostic.createdAt
    ? new Date(diagnostic.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const questions = template?.questions ?? [];
  const computed = template?.computed ?? [];
  const answered = questions.filter((q) => (diagnostic.answers[q.id] ?? "").trim());

  const vars: Record<string, number> = {};
  for (const q of questions) vars[q.id] = answerToNumber(diagnostic.answers[q.id]);
  const results = computed
    .map((c) => {
      const val = evalFormula(c.formula, vars);
      return { label: c.label, text: val == null ? null : formatComputed(val, c.format) };
    })
    .filter((r) => r.text != null);

  return (
    <div className="mx-auto max-w-3xl">
      {/* Barra de ações (não imprime) */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/gerencial/diagnostico/${diagnostic.id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Voltar ao preenchimento
        </Link>
        <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Printer className="h-4 w-4" /> Imprimir / PDF
        </button>
      </div>

      {/* Documento */}
      <div className="rounded-2xl border border-line bg-surface p-8 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2 text-brand-600">
            <Sparkles className="h-6 w-6" />
            <span className="text-lg font-bold">Viofilme</span>
          </div>
          <span className="text-xs text-muted">{date}</span>
        </div>

        <h1 className="text-2xl font-bold text-ink">{diagnostic.title}</h1>
        <p className="mt-1 text-base text-muted">{diagnostic.subject}</p>

        {/* Destaque dos resultados calculados */}
        {results.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {results.map((r, i) => (
              <div key={i} className="break-inside-avoid rounded-xl border border-brand-200 bg-brand-50 p-3 print:border-line">
                <p className="text-xs text-brand-700 print:text-muted">{r.label}</p>
                <p className="mt-0.5 text-xl font-bold text-ink">{r.text}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 space-y-4">
          {answered.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma resposta preenchida ainda.</p>
          ) : (
            answered.map((q) => (
              <div key={q.id} className="break-inside-avoid border-b border-line/60 pb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">{q.label}</p>
                <p className={q.type === "currency" || q.type === "number" ? "mt-0.5 text-lg font-bold text-ink" : "mt-0.5 whitespace-pre-wrap text-sm text-ink"}>
                  {fmtValue(q, diagnostic.answers[q.id] ?? "")}
                </p>
              </div>
            ))
          )}
        </div>

        <p className="mt-8 border-t border-line pt-4 text-[11px] text-muted">
          Diagnóstico preparado pela Viofilme · documento interno de reunião.
        </p>
      </div>
    </div>
  );
}
