"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  GOAL_METRICS,
  recentPeriods,
  periodLabel,
  type GoalMetric,
} from "@/lib/data/gestao-vista";

export function ClientGoalsCard({ clientId }: { clientId: string }) {
  const [periods] = useState(() => recentPeriods(new Date().toISOString(), 6));
  const [period, setPeriod] = useState(periods[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- efeito de busca: reinicia estado ao trocar cliente/período
    setLoading(true);
    setSaved(false);
    fetch(`/api/gerencial/client-goals?clientId=${clientId}&period=${period}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        const map: Record<string, string> = {};
        for (const g of j.goals ?? []) map[g.metric] = String(g.targetValue);
        setValues(map);
      })
      .catch(() => setValues({}))
      .finally(() => setLoading(false));
  }, [clientId, period]);

  function set(metric: GoalMetric, v: string) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [metric]: v.replace(/[^\d.]/g, "") }));
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const goals = GOAL_METRICS.map((m) => ({
        metric: m.key,
        targetValue: Number(values[m.key] ?? 0) || 0,
      }));
      const res = await fetch("/api/gerencial/client-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, period, goals }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
            <Target className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-ink">Metas do cliente</h2>
            <p className="text-xs text-muted">
              Alimentam o termômetro da Gestão à Vista. Deixe em branco para não ter meta.
            </p>
          </div>
        </div>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {periodLabel(p)}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-6 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando metas…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {GOAL_METRICS.map((m) => (
              <label key={m.key} className="block">
                <span className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
                  {m.label}
                  <span className="text-[10px] uppercase tracking-wide">
                    {m.higherBetter ? "maior = melhor" : "menor = melhor"}
                  </span>
                </span>
                <input
                  value={values[m.key] ?? ""}
                  onChange={(e) => set(m.key, e.target.value)}
                  inputMode="decimal"
                  placeholder="—"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar metas de {periodLabel(period)}
            </button>
            {saved && <span className="text-xs text-emerald-600">Metas salvas!</span>}
          </div>
        </>
      )}
    </Card>
  );
}
