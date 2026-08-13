"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Check, Loader2, Plus, Trash2 } from "lucide-react";
import {
  buildReport,
  REPORT_GROUP_BY,
  REPORT_METRIC,
  REPORT_STATUS,
  type CrmLead,
  type ReportDef,
  type ReportGroupBy,
  type ReportMetric,
  type ReportStatus,
} from "@/lib/data/crm";
import { cn, formatBRL } from "@/lib/utils";

const selCls =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

function newReport(): ReportDef {
  return { id: Math.random().toString(36).slice(2), name: "Novo relatório", groupBy: "owner", metric: "count", status: "abertos" };
}
function fmt(v: number, metric: ReportMetric): string {
  return metric === "count" ? String(v) : formatBRL(v);
}

export function ReportsBuilder({ initialReports, leads }: { initialReports: ReportDef[]; leads: CrmLead[] }) {
  const router = useRouter();
  const [reports, setReports] = useState<ReportDef[]>(initialReports);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  function patch(id: string, p: Partial<ReportDef>) {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  async function save() {
    setBusy(true);
    setSaved(false);
    await fetch("/api/crm/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports }),
    }).catch(() => {});
    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Monte relatórios por dimensão + métrica + status e salve para reabrir depois.</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReports((rs) => [...rs, newReport()])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm font-medium text-muted hover:border-brand-400 hover:text-brand-600"
          >
            <Plus className="h-4 w-4" /> Novo relatório
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
            {saved ? "Salvo" : "Salvar"}
          </button>
        </div>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
          <BarChart3 className="mx-auto mb-2 h-6 w-6 opacity-40" />
          Nenhum relatório ainda. Clique em Novo relatório para criar o primeiro.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {reports.map((r) => {
            const { rows, total } = buildReport(leads, r);
            const max = Math.max(1, ...rows.map((x) => x.value));
            return (
              <div key={r.id} className="rounded-2xl border border-line bg-surface p-4">
                <div className="mb-2 flex items-center gap-2">
                  <input
                    value={r.name}
                    onChange={(e) => patch(r.id, { name: e.target.value })}
                    className="flex-1 rounded-lg border border-transparent px-1.5 py-1 text-sm font-semibold text-ink outline-none hover:border-line focus:border-brand-400"
                  />
                  <button
                    onClick={() => setReports((rs) => rs.filter((x) => x.id !== r.id))}
                    className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  <select value={r.groupBy} onChange={(e) => patch(r.id, { groupBy: e.target.value as ReportGroupBy })} className={selCls}>
                    {REPORT_GROUP_BY.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
                  </select>
                  <select value={r.metric} onChange={(e) => patch(r.id, { metric: e.target.value as ReportMetric })} className={selCls}>
                    {REPORT_METRIC.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                  <select value={r.status} onChange={(e) => patch(r.id, { status: e.target.value as ReportStatus })} className={selCls}>
                    {REPORT_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>

                {rows.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted">Sem dados para esse filtro.</p>
                ) : (
                  <div className="space-y-1.5">
                    {rows.slice(0, 10).map((row) => (
                      <div key={row.label} className="flex items-center gap-2 text-xs">
                        <span className="w-28 shrink-0 truncate text-muted" title={row.label}>{row.label}</span>
                        <span className="relative h-4 flex-1 overflow-hidden rounded bg-subtle">
                          <span className="absolute inset-y-0 left-0 rounded bg-brand-500" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
                        </span>
                        <span className="w-20 shrink-0 text-right font-semibold text-ink">{fmt(row.value, r.metric)}</span>
                      </div>
                    ))}
                    <div className="mt-2 flex justify-between border-t border-line pt-2 text-xs">
                      <span className="text-muted">Total</span>
                      <span className="font-bold text-ink">{fmt(total, r.metric)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
