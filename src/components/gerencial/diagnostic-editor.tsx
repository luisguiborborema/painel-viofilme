"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Calculator, Check, FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { answerToNumber, evalFormula, formatComputed, type Diagnostic, type DiagnosticTemplate } from "@/lib/data/diagnostic";

const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

export function DiagnosticEditor({ diagnostic, template }: { diagnostic: Diagnostic; template: DiagnosticTemplate | null }) {
  const router = useRouter();
  const [title, setTitle] = useState(diagnostic.title);
  const [answers, setAnswers] = useState<Record<string, string>>({ ...diagnostic.answers });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (id: string, v: string) => { setAnswers((a) => ({ ...a, [id]: v })); setSaved(false); };

  const questions = template?.questions ?? [];

  // Cálculos ao vivo a partir das respostas.
  const results = useMemo(() => {
    const qs = template?.questions ?? [];
    const cs = template?.computed ?? [];
    const vars: Record<string, number> = {};
    for (const q of qs) vars[q.id] = answerToNumber(answers[q.id]);
    return cs.map((c) => {
      const val = evalFormula(c.formula, vars);
      return { label: c.label, text: val == null ? "—" : formatComputed(val, c.format) };
    });
  }, [answers, template]);

  async function save(thenDoc = false) {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/diagnostico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", id: diagnostic.id, title, answers }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        toast(j?.error ?? "Não foi possível salvar.", "error");
        return;
      }
      setSaved(true);
      router.refresh();
      if (thenDoc) router.push(`/gerencial/diagnostico/${diagnostic.id}/documento`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/gerencial/diagnostico" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Diagnósticos
        </Link>
        <div className="flex items-center gap-2">
          <button onClick={() => save(false)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4 text-emerald-600" /> : null} {saved ? "Salvo" : "Salvar"}
          </button>
          <button onClick={() => save(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            <FileText className="h-4 w-4" /> Gerar documento
          </button>
        </div>
      </div>

      <Card className="p-5">
        <p className="text-lg font-bold text-ink">{diagnostic.subject}</p>
        {template && <p className="text-xs text-muted">Modelo: {template.name}</p>}
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Título do diagnóstico</span>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} className={inputCls} />
        </label>

        {questions.length === 0 ? (
          <p className="mt-4 rounded-lg bg-subtle px-3 py-2 text-sm text-muted">Este modelo ainda não tem perguntas. Edite em Modelos & perguntas.</p>
        ) : (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            {questions.map((q) => (
              <div key={q.id}>
                <label className="mb-1 block text-sm font-medium text-ink">{q.label}</label>
                {q.hint && <p className="mb-1.5 text-xs text-muted">{q.hint}</p>}
                {q.type === "textarea" ? (
                  <textarea value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} rows={3} className={inputCls + " resize-y"} />
                ) : q.type === "choice" && q.options.length > 0 ? (
                  <select value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} className={inputCls}>
                    <option value="">Selecione…</option>
                    {q.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : q.type === "number" || q.type === "currency" ? (
                  <div className="flex items-center gap-1.5">
                    {q.type === "currency" && <span className="text-sm text-muted">R$</span>}
                    <input value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} inputMode="decimal" className={inputCls} />
                  </div>
                ) : (
                  <input value={answers[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} className={inputCls} />
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Resultados calculados (ao vivo) */}
      {results.length > 0 && (
        <Card className="p-5">
          <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
            <Calculator className="h-4 w-4 text-brand-500" /> Resultados calculados
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {results.map((r, i) => (
              <div key={i} className="rounded-xl border border-line bg-canvas p-3">
                <p className="text-xs text-muted">{r.label}</p>
                <p className="mt-0.5 text-xl font-bold text-ink">{r.text}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
