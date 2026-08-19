"use client";

import Link from "next/link";
import { ArrowLeft, Printer, Sparkles } from "lucide-react";
import type { Diagnostic, DiagnosticConfig, DiagnosticQuestion } from "@/lib/data/diagnostic";

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

export function DiagnosticDoc({ diagnostic, config }: { diagnostic: Diagnostic; config: DiagnosticConfig }) {
  const date = diagnostic.createdAt
    ? new Date(diagnostic.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
    : "";
  const answered = config.questions.filter((q) => (diagnostic.answers[q.id] ?? "").trim());

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
