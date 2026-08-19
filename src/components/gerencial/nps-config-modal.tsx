"use client";

import { useEffect, useState } from "react";
import { Check, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { NPS_DEFAULTS, type NpsQuestion } from "@/lib/data/nps";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

type QDraft = NpsQuestion & { key: number };
let seq = 1;

/** Edita textos + perguntas extras da pesquisa de NPS (escala 0–10 é fixa). */
export function NpsConfigModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ headline: "", intro: "", commentLabel: "", thankYou: "" });
  const [questions, setQuestions] = useState<QDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch("/api/gerencial/nps-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const c = j?.config ?? NPS_DEFAULTS;
        setF({ headline: c.headline ?? "", intro: c.intro ?? "", commentLabel: c.commentLabel ?? "", thankYou: c.thankYou ?? "" });
        setQuestions(((c.questions ?? []) as NpsQuestion[]).map((q) => ({ ...q, key: seq++ })));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const setQ = (key: number, patch: Partial<QDraft>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  const addQ = () =>
    setQuestions((qs) => [...qs, { key: seq++, id: `q${Date.now().toString(36)}`, label: "", type: "text", options: [] }]);
  const removeQ = (key: number) => setQuestions((qs) => qs.filter((q) => q.key !== key));

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/nps-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          questions: questions
            .filter((q) => q.label.trim())
            .map((q) => ({ id: q.id, label: q.label, type: q.type, options: q.options })),
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Não foi possível salvar.", "error");
      else {
        toast("Pesquisa de NPS salva.", "success");
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
      title="Personalizar pesquisa de NPS"
      description="Edite os textos e adicione perguntas extras. A escala de 0 a 10 é fixa (padrão NPS)."
      size="lg"
      footer={
        <button
          onClick={save}
          disabled={busy || loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
        </button>
      }
    >
      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <label className="block">
              <span className={labelCls}>Pergunta principal (nota 0–10)</span>
              <textarea value={f.headline} onChange={(e) => set("headline", e.target.value)} rows={2} placeholder={NPS_DEFAULTS.headline} className={inputCls + " resize-y"} />
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={labelCls}>Introdução (subtítulo)</span>
                <input value={f.intro} onChange={(e) => set("intro", e.target.value)} placeholder="Padrão: Pesquisa de satisfação · <cliente>" className={inputCls} />
              </label>
              <label className="block">
                <span className={labelCls}>Rótulo do comentário</span>
                <input value={f.commentLabel} onChange={(e) => set("commentLabel", e.target.value)} placeholder={NPS_DEFAULTS.commentLabel} className={inputCls} />
              </label>
            </div>
            <label className="block">
              <span className={labelCls}>Mensagem de agradecimento</span>
              <textarea value={f.thankYou} onChange={(e) => set("thankYou", e.target.value)} rows={2} placeholder={NPS_DEFAULTS.thankYou} className={inputCls + " resize-y"} />
            </label>
          </div>

          {/* Perguntas extras */}
          <div className="border-t border-line pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Perguntas extras (opcional)</p>
              <button onClick={addQ} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle">
                <Plus className="h-3.5 w-3.5" /> Adicionar pergunta
              </button>
            </div>
            {questions.length === 0 ? (
              <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">
                Sem perguntas extras. A pesquisa terá só a nota 0–10 e o comentário.
              </p>
            ) : (
              <div className="space-y-2.5">
                {questions.map((q) => (
                  <div key={q.key} className="rounded-xl border border-line p-2.5">
                    <div className="flex items-start gap-2">
                      <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted/50" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <input
                          value={q.label}
                          onChange={(e) => setQ(q.key, { label: e.target.value })}
                          placeholder="Texto da pergunta (ex.: O que podemos melhorar?)"
                          className={inputCls}
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={q.type}
                            onChange={(e) => setQ(q.key, { type: e.target.value as NpsQuestion["type"] })}
                            className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
                          >
                            <option value="text">Resposta livre</option>
                            <option value="choice">Escolha única</option>
                          </select>
                          {q.type === "choice" && (
                            <input
                              value={q.options.join(", ")}
                              onChange={(e) => setQ(q.key, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })}
                              placeholder="Opções separadas por vírgula"
                              className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400"
                            />
                          )}
                        </div>
                      </div>
                      <button onClick={() => removeQ(q.key)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500" aria-label="Remover pergunta">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
