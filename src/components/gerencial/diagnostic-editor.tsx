"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, FileText, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import type { Diagnostic, DiagnosticConfig } from "@/lib/data/diagnostic";

const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

export function DiagnosticEditor({ diagnostic, config }: { diagnostic: Diagnostic; config: DiagnosticConfig }) {
  const router = useRouter();
  const [title, setTitle] = useState(diagnostic.title);
  const [answers, setAnswers] = useState<Record<string, string>>({ ...diagnostic.answers });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const set = (id: string, v: string) => { setAnswers((a) => ({ ...a, [id]: v })); setSaved(false); };

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
        <label className="mt-3 block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Título do diagnóstico</span>
          <input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} className={inputCls} />
        </label>

        <div className="mt-4 space-y-4 border-t border-line pt-4">
          {config.questions.map((q) => (
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
      </Card>
    </div>
  );
}
