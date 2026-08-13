"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import {
  SCORE_RULE_FIELDS,
  SCORE_RULE_OPS,
  type LeadScoreRule,
  type ScoreRuleOp,
} from "@/lib/data/crm";
import { cn } from "@/lib/utils";

const inputCls =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

function newRule(): LeadScoreRule {
  return { id: Math.random().toString(36).slice(2), label: "", field: "monthly_value", op: "gt", value: "", points: 10 };
}

export function LeadScoreManager({
  initialRules,
  dealProps,
}: {
  initialRules: LeadScoreRule[];
  dealProps: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [rules, setRules] = useState<LeadScoreRule[]>(initialRules);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function patch(id: string, p: Partial<LeadScoreRule>) {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  async function save() {
    setBusy(true);
    setSaved(false);
    await fetch("/api/crm/score-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rules }),
    }).catch(() => {});
    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted">
        Some pontos por critério (estilo HubSpot). Pontos podem ser <strong className="text-ink">negativos</strong>. O
        total aparece na ficha do negócio como <strong className="text-ink">Pontuação (regras)</strong>.
      </p>

      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2.5">
            <input
              value={r.label}
              onChange={(e) => patch(r.id, { label: e.target.value })}
              placeholder="Rótulo (opcional)"
              className={inputCls + " w-36"}
            />
            <select value={r.field} onChange={(e) => patch(r.id, { field: e.target.value })} className={inputCls}>
              <optgroup label="Nativos">
                {SCORE_RULE_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </optgroup>
              {dealProps.length > 0 && (
                <optgroup label="Propriedades">
                  {dealProps.map((p) => (
                    <option key={p.key} value={p.key}>{p.label}</option>
                  ))}
                </optgroup>
              )}
            </select>
            <select value={r.op} onChange={(e) => patch(r.id, { op: e.target.value as ScoreRuleOp })} className={inputCls}>
              {SCORE_RULE_OPS.map((o) => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            {r.op !== "filled" && r.op !== "empty" && (
              <input
                value={r.value}
                onChange={(e) => patch(r.id, { value: e.target.value })}
                placeholder="valor"
                className={inputCls + " w-24"}
              />
            )}
            <span className="inline-flex items-center gap-1">
              <input
                type="number"
                value={r.points}
                onChange={(e) => patch(r.id, { points: Number(e.target.value) || 0 })}
                className={inputCls + " w-20"}
              />
              <span className="text-xs text-muted">pts</span>
            </span>
            <button
              onClick={() => setRules((rs) => rs.filter((x) => x.id !== r.id))}
              className="ml-auto rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"
              title="Remover regra"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {rules.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-sm text-muted">
            Sem regras. Adicione a primeira abaixo.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setRules((rs) => [...rs, newRule()])}
          className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm font-medium text-muted hover:border-brand-400 hover:text-brand-600"
        >
          <Plus className="h-4 w-4" /> Nova regra
        </button>
        <button
          onClick={save}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-60",
            saved ? "bg-emerald-600" : "bg-brand-600 hover:bg-brand-700",
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Salvo" : "Salvar regras"}
        </button>
      </div>
    </div>
  );
}
