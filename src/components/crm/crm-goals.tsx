"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Target, TrendingUp } from "lucide-react";
import { cn, formatBRL } from "@/lib/utils";
import type { Forecast, ForecastRow } from "@/lib/data/crm";

function attColor(pct: number): string {
  if (pct >= 100) return "bg-emerald-500";
  if (pct >= 60) return "bg-brand-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

export function CrmGoals({
  forecast,
  monthLabel,
  canEdit,
}: {
  forecast: Forecast;
  monthLabel: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveTarget(owner: string) {
    setBusy(true);
    await fetch("/api/crm/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, month: forecast.month, target: Number(value) || 0 }),
    }).catch(() => {});
    setBusy(false);
    setEditing(null);
    router.refresh();
  }

  const t = forecast.totals;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">
          Metas de <span className="font-medium text-ink">{monthLabel}</span>
        </p>
        {!canEdit && (
          <span className="text-xs text-muted">Só o Gestor edita metas.</span>
        )}
      </div>

      {/* Totais do time */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icon={<Target className="h-4 w-4" />} label="Meta do time" value={formatBRL(t.target)} />
        <Kpi icon={<Check className="h-4 w-4" />} label="Ganho no mês" value={formatBRL(t.won)} hint={`${t.attainment}% da meta`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Previsão" value={formatBRL(t.forecast)} hint={`+ ${formatBRL(t.weighted)} ponderado`} />
        <Kpi icon={<Target className="h-4 w-4" />} label="Falta fechar" value={formatBRL(t.gap)} />
      </div>

      {/* Por vendedor */}
      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_1.6fr] gap-2 border-b border-line px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span>Vendedor</span>
          <span className="text-right">Meta</span>
          <span className="text-right">Ganho</span>
          <span>Atingimento</span>
        </div>
        {forecast.rows.map((r) => (
          <Row
            key={r.owner}
            r={r}
            editing={editing === r.owner}
            canEdit={canEdit}
            busy={busy}
            value={value}
            onEdit={() => { setEditing(r.owner); setValue(String(r.target || "")); }}
            onCancel={() => setEditing(null)}
            onChange={setValue}
            onSave={() => saveTarget(r.owner)}
          />
        ))}
        {forecast.rows.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">Sem vendedores/negócios ainda.</p>
        )}
      </div>
      <p className="text-[11px] text-muted">
        Previsão = ganho no mês + pipeline aberto ponderado pela probabilidade de cada estágio.
      </p>
    </div>
  );
}

function Kpi({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-muted">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1 text-xl font-bold text-ink">{value}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

function Row({
  r, editing, canEdit, busy, value, onEdit, onCancel, onChange, onSave,
}: {
  r: ForecastRow;
  editing: boolean;
  canEdit: boolean;
  busy: boolean;
  value: string;
  onEdit: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
  onSave: () => void;
}) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr_1.6fr] items-center gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <span className="truncate text-sm font-medium text-ink">{r.owner}</span>
      <div className="text-right text-sm">
        {editing ? (
          <div className="flex items-center justify-end gap-1">
            <input
              autoFocus
              value={value}
              onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && onSave()}
              className="w-20 rounded-lg border border-line bg-surface px-2 py-1 text-right text-sm text-ink outline-none focus:border-brand-400"
            />
            <button onClick={onSave} disabled={busy} className="rounded bg-brand-600 p-1 text-white hover:bg-brand-700">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </button>
            <button onClick={onCancel} className="rounded p-1 text-muted hover:bg-subtle">✕</button>
          </div>
        ) : (
          <button
            onClick={canEdit ? onEdit : undefined}
            className={cn("text-ink", canEdit && "rounded px-1 hover:bg-subtle")}
          >
            {r.target ? formatBRL(r.target) : canEdit ? "definir" : "—"}
          </button>
        )}
      </div>
      <span className="text-right text-sm font-semibold text-ink">{formatBRL(r.won)}</span>
      <div className="flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
          <div className={cn("h-full rounded-full", attColor(r.attainment))} style={{ width: `${Math.min(100, r.attainment)}%` }} />
        </div>
        <span className="w-10 text-right text-xs font-semibold text-ink">{r.attainment}%</span>
      </div>
    </div>
  );
}
