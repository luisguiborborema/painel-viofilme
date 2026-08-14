"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Check, Loader2, Plus, Trash2 } from "lucide-react";
import {
  buildReport,
  REPORT_GROUP_BY,
  REPORT_METRIC,
  REPORT_STATUS,
  REPORT_CHART,
  type CrmLead,
  type DashboardDef,
  type ReportChart,
  type ReportDef,
  type ReportGroupBy,
  type ReportMetric,
  type ReportStatus,
} from "@/lib/data/crm";
import { cn, formatBRL } from "@/lib/utils";

const selCls =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const PALETTE = ["#ff7a59", "#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6", "#ec4899", "#64748b", "#eab308"];

function newReport(dashboardId: string | null): ReportDef {
  return { id: Math.random().toString(36).slice(2), name: "Novo relatório", groupBy: "owner", metric: "count", status: "abertos", chart: "bar", dashboardId };
}
function fmt(v: number, metric: ReportMetric): string {
  return metric === "count" ? String(v) : formatBRL(v);
}

export function ReportsBuilder({
  initialReports,
  initialDashboards = [],
  leads,
}: {
  initialReports: ReportDef[];
  initialDashboards?: DashboardDef[];
  leads: CrmLead[];
}) {
  const router = useRouter();
  const [reports, setReports] = useState<ReportDef[]>(initialReports);
  const [dashboards, setDashboards] = useState<DashboardDef[]>(initialDashboards);
  const [activeDash, setActiveDash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const shown = activeDash ? reports.filter((r) => r.dashboardId === activeDash) : reports;

  function patch(id: string, p: Partial<ReportDef>) {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, ...p } : r)));
  }
  async function save(next?: { reports?: ReportDef[]; dashboards?: DashboardDef[] }) {
    setBusy(true);
    setSaved(false);
    await fetch("/api/crm/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reports: next?.reports ?? reports, dashboards: next?.dashboards ?? dashboards }),
    }).catch(() => {});
    setBusy(false);
    setSaved(true);
    router.refresh();
    setTimeout(() => setSaved(false), 1800);
  }
  function addDashboard() {
    const name = window.prompt("Nome do dashboard:");
    if (!name?.trim()) return;
    const d = { id: Math.random().toString(36).slice(2), name: name.trim() };
    const nextD = [...dashboards, d];
    setDashboards(nextD);
    setActiveDash(d.id);
    save({ dashboards: nextD });
  }

  return (
    <div className="space-y-4">
      {/* Abas de dashboards (estilo HubSpot) */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
        <DashTab active={activeDash === null} onClick={() => setActiveDash(null)} label="Todos os relatórios" />
        {dashboards.map((d) => (
          <DashTab
            key={d.id}
            active={activeDash === d.id}
            onClick={() => setActiveDash(d.id)}
            onDelete={() => {
              const nextD = dashboards.filter((x) => x.id !== d.id);
              const nextR = reports.map((r) => (r.dashboardId === d.id ? { ...r, dashboardId: null } : r));
              setDashboards(nextD);
              setReports(nextR);
              if (activeDash === d.id) setActiveDash(null);
              save({ reports: nextR, dashboards: nextD });
            }}
            label={d.name}
          />
        ))}
        <button onClick={addDashboard} className="ml-1 whitespace-nowrap px-2 py-2 text-sm font-medium text-brand-600 hover:text-brand-700">
          + Novo dashboard
        </button>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">Relatórios por dimensão × métrica × status, com o tipo de gráfico. Agrupe em dashboards.</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setReports((rs) => [...rs, newReport(activeDash)])}
            className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-line px-3 py-2 text-sm font-medium text-muted hover:border-brand-400 hover:text-brand-600"
          >
            <Plus className="h-4 w-4" /> Novo relatório
          </button>
          <button
            onClick={() => save()}
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

      {shown.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
          <BarChart3 className="mx-auto mb-2 h-6 w-6 opacity-40" />
          Nenhum relatório {activeDash ? "neste dashboard" : "ainda"}. Clique em Novo relatório.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((r) => {
            const { rows, total } = buildReport(leads, r);
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
                  <select value={r.chart ?? "bar"} onChange={(e) => patch(r.id, { chart: e.target.value as ReportChart })} className={selCls}>
                    {REPORT_CHART.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  {dashboards.length > 0 && (
                    <select value={r.dashboardId ?? ""} onChange={(e) => patch(r.id, { dashboardId: e.target.value || null })} className={selCls} title="Dashboard">
                      <option value="">— sem dashboard —</option>
                      {dashboards.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  )}
                </div>
                <ReportChartView rows={rows} total={total} report={r} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportChartView({ rows, total, report }: { rows: { label: string; value: number }[]; total: number; report: ReportDef }) {
  const metric = report.metric;
  const chart = report.chart ?? "bar";
  if (rows.length === 0) return <p className="py-6 text-center text-xs text-muted">Sem dados para esse filtro.</p>;

  if (chart === "number") {
    return (
      <div className="py-6 text-center">
        <p className="text-3xl font-bold text-brand-600">{fmt(total, metric)}</p>
        <p className="text-xs text-muted">{rows.length} grupo(s)</p>
      </div>
    );
  }
  if (chart === "pie") {
    // >10 grupos: agrega o excedente numa fatia "Outros" para o donut representar
    // 100% do total — senão a última fatia desenhada absorveria todo o arco restante.
    const display =
      rows.length > PALETTE.length
        ? [
            ...rows.slice(0, PALETTE.length - 1),
            { label: "Outros", value: rows.slice(PALETTE.length - 1).reduce((s, r) => s + r.value, 0) },
          ]
        : rows;
    const cumulative = display.map((_, i) => display.slice(0, i + 1).reduce((s, r) => s + r.value, 0));
    const bg =
      total > 0
        ? `conic-gradient(${display
            .map((row, i) => `${PALETTE[i]} ${((cumulative[i] - row.value) / total) * 100}% ${(cumulative[i] / total) * 100}%`)
            .join(",")})`
        : "var(--color-line)"; // total 0 → anel neutro, não um disco sólido da última cor
    return (
      <div className="flex items-center gap-4">
        <div className="h-28 w-28 shrink-0 rounded-full" style={{ background: bg }}>
          <div className="flex h-full w-full items-center justify-center">
            <div className="h-16 w-16 rounded-full bg-surface" />
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          {display.map((row, i) => (
            <div key={row.label} className="flex items-center gap-2 text-xs">
              <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: PALETTE[i] }} />
              <span className="min-w-0 flex-1 truncate text-muted" title={row.label}>{row.label}</span>
              <span className="shrink-0 font-semibold text-ink">{fmt(row.value, metric)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (chart === "line") {
    const max = Math.max(1, ...rows.map((r) => r.value));
    const w = 300;
    const h = 90;
    const step = rows.length > 1 ? w / (rows.length - 1) : w;
    // 1 ponto: desenha uma reta horizontal (uma coordenada só não renderiza linha).
    const pts =
      rows.length === 1
        ? `0,${h - (rows[0].value / max) * h} ${w},${h - (rows[0].value / max) * h}`
        : rows.map((r, i) => `${i * step},${h - (r.value / max) * h}`).join(" ");
    return (
      <div className="space-y-1">
        <svg viewBox={`0 0 ${w} ${h}`} className="h-24 w-full" preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke="var(--color-brand-500)" strokeWidth="2" />
        </svg>
        <div className="flex justify-between text-[10px] text-muted">
          <span>{rows[0]?.label}</span>
          <span>{rows[rows.length - 1]?.label}</span>
        </div>
        <div className="flex justify-end border-t border-line pt-1 text-xs">
          <span className="text-muted">Total&nbsp;</span><span className="font-bold text-ink">{fmt(total, metric)}</span>
        </div>
      </div>
    );
  }
  // bar (padrão)
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.slice(0, 10).map((row) => (
        <div key={row.label} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-muted" title={row.label}>{row.label}</span>
          <span className="relative h-4 flex-1 overflow-hidden rounded bg-subtle">
            <span className="absolute inset-y-0 left-0 rounded bg-brand-500" style={{ width: `${Math.round((row.value / max) * 100)}%` }} />
          </span>
          <span className="w-20 shrink-0 text-right font-semibold text-ink">{fmt(row.value, metric)}</span>
        </div>
      ))}
      <div className="mt-2 flex justify-between border-t border-line pt-2 text-xs">
        <span className="text-muted">Total</span>
        <span className="font-bold text-ink">{fmt(total, metric)}</span>
      </div>
    </div>
  );
}

function DashTab({ active, onClick, label, onDelete }: { active: boolean; onClick: () => void; label: string; onDelete?: () => void }) {
  return (
    <span
      className={cn(
        "group -mb-px inline-flex shrink-0 items-center gap-1 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      <button type="button" onClick={onClick}>{label}</button>
      {onDelete && (
        <button type="button" onClick={onDelete} className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100" title="Excluir dashboard">
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
