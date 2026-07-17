"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  GOAL_METRICS,
  GOAL_METRICS_BY_TYPE,
  recentPeriods,
  periodLabel,
  type ClientType,
  type GoalMetric,
} from "@/lib/data/gestao-vista";

const TYPE_LABEL: Record<ClientType, string> = {
  local_business: "Negócio local",
  lead_gen: "Geração de leads",
  ecommerce: "E-commerce",
};

export function ClientGoalsCard({
  clientId,
  clientType,
}: {
  clientId: string;
  clientType: ClientType;
}) {
  const [periods] = useState(() => recentPeriods(new Date().toISOString(), 6));
  const [period, setPeriod] = useState(periods[0]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState(0);

  // Formulário dinâmico: só as métricas do modelo de negócio do cliente.
  const metrics = useMemo(() => {
    const keys = GOAL_METRICS_BY_TYPE[clientType] ?? [];
    return keys
      .map((k) => GOAL_METRICS.find((m) => m.key === k))
      .filter((m): m is (typeof GOAL_METRICS)[number] => !!m);
  }, [clientType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- efeito de busca: reinicia estado ao trocar cliente/período
    setLoading(true);
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
    setValues((prev) => ({ ...prev, [metric]: v.replace(/[^\d.]/g, "") }));
  }

  // Auto-save (on-blur): grava só a métrica editada nesta competência.
  async function saveMetric(metric: GoalMetric) {
    setSavingKey(metric);
    try {
      const res = await fetch("/api/gerencial/client-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          period,
          goals: [{ metric, targetValue: Number(values[metric] ?? 0) || 0 }],
        }),
      });
      if (res.ok) setSavedAt(Date.now());
    } finally {
      setSavingKey(null);
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
            <h2 className="text-sm font-semibold text-ink">
              Metas do cliente
              <span className="ml-2 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted">
                {TYPE_LABEL[clientType]}
              </span>
            </h2>
            <p className="text-xs text-muted">
              Campos do modelo de negócio · alimentam a Gestão à Vista · salvam ao sair do campo.
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
            {metrics.map((m) => (
              <label key={m.key} className="block">
                <span className="mb-1 flex items-center justify-between text-xs font-medium text-muted">
                  {m.label}
                  <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide">
                    {savingKey === m.key && <Loader2 className="h-3 w-3 animate-spin" />}
                    {m.higherBetter ? "maior = melhor" : "menor = melhor"}
                  </span>
                </span>
                <input
                  value={values[m.key] ?? ""}
                  onChange={(e) => set(m.key, e.target.value)}
                  onBlur={() => saveMetric(m.key)}
                  inputMode="decimal"
                  placeholder="—"
                  className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
                />
              </label>
            ))}
          </div>
          {savedAt > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Metas salvas
            </p>
          )}
          <p className="mt-3 text-[11px] text-muted">
            Essas metas alimentam os gráficos de tendência no Portal do Cliente e o
            termômetro da Gestão à Vista.
          </p>
        </>
      )}
    </Card>
  );
}
