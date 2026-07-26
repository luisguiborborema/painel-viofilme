"use client";

import { useMemo, useState } from "react";
import { Activity, BarChart3, Clock, Download, Search, Users, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { actionLabel } from "@/lib/audit/labels";

export type AuditRow = {
  id: string;
  createdAt: string;
  userName: string | null;
  userEmail: string | null;
  panel: string;
  action: string;
  area: string | null;
  target: string | null;
  detail: string | null;
};

export type Analytics = {
  pageviews: number;
  activeUsers: number;
  byArea: { label: string; count: number }[];
  byUser: { label: string; count: number }[];
  byHour: number[];
};

const FILTER_CLS =
  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400";

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function actionChip(action: string) {
  switch (action) {
    case "login":
      return "bg-emerald-500/15 text-emerald-600";
    case "logout":
      return "bg-muted/20 text-muted";
    case "create":
      return "bg-brand-500/15 text-brand-600";
    case "move":
    case "status_change":
      return "bg-sky-500/15 text-sky-600";
    case "edit":
    case "update":
      return "bg-violet-500/15 text-violet-600";
    case "delete":
      return "bg-rose-500/15 text-rose-500";
    default:
      return "bg-subtle text-muted";
  }
}

function BarList({ title, rows, tone }: { title: string; rows: { label: string; count: number }[]; tone: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted">Sem dados ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-xs text-ink" title={r.label}>{r.label}</span>
              <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                <span className={cn("absolute inset-y-0 left-0 rounded-full", tone)} style={{ width: `${Math.max(4, (r.count / max) * 100)}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right text-xs font-semibold text-ink">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function MonitoringView({ events, analytics }: { events: AuditRow[]; analytics: Analytics }) {
  const [panel, setPanel] = useState("");
  const [area, setArea] = useState("");
  const [userF, setUserF] = useState("");
  const [actionF, setActionF] = useState("");
  const [search, setSearch] = useState("");

  const areas = useMemo(() => [...new Set(events.map((e) => e.area).filter(Boolean) as string[])].sort(), [events]);
  const users = useMemo(() => [...new Set(events.map((e) => e.userName).filter(Boolean) as string[])].sort(), [events]);
  const actions = useMemo(() => [...new Set(events.map((e) => e.action))].sort(), [events]);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      events.filter(
        (e) =>
          (!panel || e.panel === panel) &&
          (!area || e.area === area) &&
          (!userF || e.userName === userF) &&
          (!actionF || e.action === actionF) &&
          (!term ||
            (e.userName ?? "").toLowerCase().includes(term) ||
            (e.userEmail ?? "").toLowerCase().includes(term) ||
            (e.area ?? "").toLowerCase().includes(term) ||
            (e.target ?? "").toLowerCase().includes(term) ||
            (e.detail ?? "").toLowerCase().includes(term)),
      ),
    [events, panel, area, userF, actionF, term],
  );

  const activeFilters = (panel ? 1 : 0) + (area ? 1 : 0) + (userF ? 1 : 0) + (actionF ? 1 : 0) + (term ? 1 : 0);
  function clear() {
    setPanel("");
    setArea("");
    setUserF("");
    setActionF("");
    setSearch("");
  }

  function exportCsv() {
    const header = ["Quando", "Quem", "Email", "Painel", "Ação", "Onde", "Detalhes"];
    const rows = filtered.map((e) => [
      fmtDate(e.createdAt),
      e.userName ?? "",
      e.userEmail ?? "",
      e.panel,
      actionLabel(e.action),
      e.area ?? "",
      e.detail ?? e.target ?? "",
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "monitoramento.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const maxHour = Math.max(1, ...analytics.byHour);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Eventos (linha do tempo)", value: events.length, icon: Activity, tone: "text-ink" },
          { label: "Acessos (30 dias)", value: analytics.pageviews, icon: BarChart3, tone: "text-brand-600" },
          { label: "Usuários ativos", value: analytics.activeUsers, icon: Users, tone: "text-emerald-600" },
          { label: "Abas distintas", value: analytics.byArea.length, icon: Clock, tone: "text-sky-600" },
        ].map((k) => (
          <div key={k.label} className="rounded-2xl border border-line bg-surface p-3">
            <k.icon className="mb-1 h-4 w-4 text-muted" />
            <p className={cn("text-xl font-bold", k.tone)}>{k.value}</p>
            <p className="text-[11px] text-muted">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Analytics: uso */}
      <div className="grid gap-3 lg:grid-cols-3">
        <BarList title="Acessos por página (abas mais abertas)" rows={analytics.byArea} tone="bg-brand-500" />
        <BarList title="Atividade por usuário" rows={analytics.byUser} tone="bg-emerald-500" />
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Mapa de calor — acessos por hora</p>
          <div className="grid grid-cols-12 gap-1">
            {analytics.byHour.map((c, h) => (
              <div
                key={h}
                title={`${h}h — ${c} acesso(s)`}
                className="aspect-square rounded-sm bg-subtle"
                style={c ? { backgroundColor: `rgba(37,99,235,${(0.15 + 0.85 * (c / maxHour)).toFixed(2)})` } : undefined}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted">
            <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
          </div>
        </div>
      </div>

      {/* Linha do tempo */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold text-ink">Linha do tempo de eventos</h2>
          <span className="text-xs text-muted">{filtered.length} evento(s)</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <select value={panel} onChange={(e) => setPanel(e.target.value)} className={FILTER_CLS}>
              <option value="">Todos os painéis</option>
              <option value="gerencial">Gerencial</option>
              <option value="cliente">Cliente</option>
            </select>
            <select value={area} onChange={(e) => setArea(e.target.value)} className={FILTER_CLS}>
              <option value="">Todas as áreas</option>
              {areas.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select value={userF} onChange={(e) => setUserF(e.target.value)} className={FILTER_CLS}>
              <option value="">Todos usuários</option>
              {users.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <select value={actionF} onChange={(e) => setActionF(e.target.value)} className={FILTER_CLS}>
              <option value="">Todas as ações</option>
              {actions.map((a) => <option key={a} value={a}>{actionLabel(a)}</option>)}
            </select>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" className="w-32 rounded-lg border border-line bg-surface py-1.5 pl-7 pr-2 text-xs text-ink outline-none focus:border-brand-400 sm:w-44" />
            </div>
            {activeFilters > 0 && (
              <button onClick={clear} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
                <X className="h-3.5 w-3.5" /> limpar ({activeFilters})
              </button>
            )}
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-4 py-2.5 font-medium">Quando</th>
                <th className="px-4 py-2.5 font-medium">Quem</th>
                <th className="px-4 py-2.5 font-medium">Ação</th>
                <th className="px-4 py-2.5 font-medium">Onde</th>
                <th className="px-4 py-2.5 font-medium">Detalhes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted">
                    Nenhum evento {events.length ? "com esses filtros" : "registrado ainda"}.
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-line/60 last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{fmtDate(e.createdAt)}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">
                    {e.userName || "—"}
                    {e.panel === "cliente" && <span className="ml-1.5 rounded-full bg-subtle px-1.5 text-[10px] text-muted">cliente</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", actionChip(e.action))}>{actionLabel(e.action)}</span>
                  </td>
                  <td className="px-4 py-2.5 text-muted">{e.area || "—"}</td>
                  <td className="max-w-[280px] truncate px-4 py-2.5 text-muted" title={e.detail || e.target || ""}>
                    {e.detail || e.target || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
