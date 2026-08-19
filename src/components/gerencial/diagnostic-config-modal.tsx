"use client";

import { useEffect, useState } from "react";
import { Check, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { DIAGNOSTIC_DEFAULTS, type DiagnosticFieldType, type DiagnosticQuestion } from "@/lib/data/diagnostic";

const inputCls = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

type QDraft = DiagnosticQuestion & { key: number };
let seq = 1;

const TYPE_LABEL: Record<DiagnosticFieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  number: "Número",
  currency: "Valor (R$)",
  choice: "Escolha única",
};

export function DiagnosticConfigModal({ onClose }: { onClose: () => void }) {
  const [questions, setQuestions] = useState<QDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/gerencial/diagnostico-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const qs = (j?.config?.questions ?? DIAGNOSTIC_DEFAULTS) as DiagnosticQuestion[];
        setQuestions(qs.map((q) => ({ ...q, key: seq++ })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setQ = (key: number, patch: Partial<QDraft>) => setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const addQ = () => setQuestions((qs) => [...qs, { key: seq++, id: `q${Date.now().toString(36)}`, label: "", type: "text", options: [], hint: "" }]);
  const removeQ = (key: number) => setQuestions((qs) => qs.filter((q) => q.key !== key));

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/diagnostico-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questions.filter((q) => q.label.trim()).map((q) => ({ id: q.id, label: q.label, type: q.type, options: q.options, hint: q.hint })),
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Não foi possível salvar.", "error");
      else {
        toast("Perguntas do diagnóstico salvas.", "success");
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Perguntas do diagnóstico"
      description="Monte o roteiro que o time preenche na reunião. Vale para todos os diagnósticos."
      size="lg"
      footer={
        <button onClick={save} disabled={busy || loading} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
        </button>
      }
    >
      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      ) : (
        <div className="space-y-2.5">
          <div className="flex justify-end">
            <button onClick={addQ} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle">
              <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
            </button>
          </div>
          {questions.length === 0 && <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">Nenhuma pergunta. Adicione a primeira.</p>}
          {questions.map((q) => (
            <div key={q.key} className="rounded-xl border border-line p-2.5">
              <div className="flex items-start gap-2">
                <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted/50" />
                <div className="min-w-0 flex-1 space-y-2">
                  <input value={q.label} onChange={(e) => setQ(q.key, { label: e.target.value })} placeholder="Pergunta (ex.: Quanto está deixando de ganhar por mês?)" className={inputCls} />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={q.type} onChange={(e) => setQ(q.key, { type: e.target.value as DiagnosticFieldType })} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400">
                      {(Object.keys(TYPE_LABEL) as DiagnosticFieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                    </select>
                    <input value={q.hint} onChange={(e) => setQ(q.key, { hint: e.target.value })} placeholder="Dica (opcional)" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400" />
                  </div>
                  {q.type === "choice" && (
                    <input value={q.options.join(", ")} onChange={(e) => setQ(q.key, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Opções separadas por vírgula" className={inputCls} />
                  )}
                </div>
                <button onClick={() => removeQ(q.key)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500" aria-label="Remover">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
