"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { CSClient, CSStatus } from "@/lib/data/types";

type TabKey = "todas" | "risco" | "saudaveis" | "renovacao";

function scoreTone(s: number) {
  if (s >= 75) return "text-emerald-400";
  if (s >= 50) return "text-amber-400";
  return "text-rose-400";
}
function scoreBar(s: number) {
  if (s >= 75) return "bg-emerald-400";
  if (s >= 50) return "bg-amber-400";
  return "bg-rose-400";
}
function npsTone(n: number) {
  if (n >= 9) return "text-emerald-400";
  if (n >= 7) return "text-amber-400";
  return "text-rose-400";
}
function npsDot(n: number) {
  if (n >= 9) return "bg-emerald-400";
  if (n >= 7) return "bg-amber-400";
  return "bg-rose-400";
}
const STATUS_TONE: Record<CSStatus["tone"], string> = {
  ok: "text-emerald-300",
  warn: "text-amber-300",
  danger: "text-rose-300",
};

function lastContactLabel(days: number) {
  if (days === 0) return "Hoje";
  return `Há ${days} ${days === 1 ? "dia" : "dias"}`;
}

function initials(name: string) {
  return name
    .replace(/[^A-Za-zÀ-ú ]/g, "")
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

export function CSClientsTable({
  clients,
  mrrTotal,
}: {
  clients: CSClient[];
  mrrTotal: number;
}) {
  const [tab, setTab] = useState<TabKey>("todas");
  const [q, setQ] = useState("");

  const counts = {
    todas: clients.length,
    risco: clients.filter((c) => c.atRisk).length,
    saudaveis: clients.filter((c) => c.healthy).length,
    renovacao: clients.filter((c) => c.renewingSoon).length,
  };

  const TABS: { key: TabKey; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "risco", label: "Risco" },
    { key: "saudaveis", label: "Saudáveis" },
    { key: "renovacao", label: "Renovação próxima" },
  ];

  const filtered = useMemo(() => {
    let list = clients;
    if (tab === "risco") list = list.filter((c) => c.atRisk);
    else if (tab === "saudaveis") list = list.filter((c) => c.healthy);
    else if (tab === "renovacao") list = list.filter((c) => c.renewingSoon);
    const term = q.trim().toLowerCase();
    if (term)
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          c.segment.toLowerCase().includes(term),
      );
    return list;
  }, [clients, tab, q]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-sm font-medium transition-colors",
              tab === t.key
                ? "bg-brand-500 text-white"
                : "bg-subtle text-muted hover:text-ink",
            )}
          >
            {t.label}
            <span
              className={cn(
                "rounded-full px-1.5 text-xs font-semibold",
                tab === t.key ? "bg-white/25 text-white" : "bg-subtle-strong",
              )}
            >
              {counts[t.key]}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar cliente…"
          className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none placeholder:text-muted focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Score saúde</th>
              <th className="px-4 py-3 font-medium">NPS</th>
              <th className="px-4 py-3 font-medium">Financeiro</th>
              <th className="px-4 py-3 font-medium">Contrato</th>
              <th className="px-4 py-3 font-medium">CS</th>
              <th className="px-4 py-3 font-medium">Último contato</th>
              <th className="px-4 py-3 text-right font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr
                key={c.id}
                className="border-b border-line last:border-0 hover:bg-subtle"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-xs font-bold text-brand-300">
                      {initials(c.name)}
                    </span>
                    <div>
                      <p className="font-medium text-ink">{c.name}</p>
                      <p className="text-xs text-muted">
                        {c.segment} · R$ {formatNumber(c.mrr)}/mês
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-subtle-strong">
                      <div
                        className={cn("h-full rounded-full", scoreBar(c.healthScore))}
                        style={{ width: `${c.healthScore}%` }}
                      />
                    </div>
                    <span className={cn("font-semibold", scoreTone(c.healthScore))}>
                      {c.healthScore}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={cn("inline-flex items-center gap-1.5 font-semibold", npsTone(c.nps))}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", npsDot(c.nps))} />
                    {c.nps}
                  </span>
                </td>
                <td className={cn("px-4 py-3 font-medium", STATUS_TONE[c.financial.tone])}>
                  {c.financial.label}
                </td>
                <td className={cn("px-4 py-3 font-medium", STATUS_TONE[c.contract.tone])}>
                  {c.contract.label}
                </td>
                <td className="px-4 py-3 text-muted">{c.cs}</td>
                <td
                  className={cn(
                    "px-4 py-3",
                    c.lastContactDays > 14 ? "text-rose-400" : "text-muted",
                  )}
                >
                  {lastContactLabel(c.lastContactDays)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/gerencial/clientes/${c.id}`}
                    className={cn(
                      "inline-flex items-center gap-1 text-sm font-medium",
                      c.atRisk
                        ? "text-rose-400 hover:text-rose-300"
                        : "text-brand-300 hover:text-brand-200",
                    )}
                  >
                    {c.atRisk ? "Resgatar" : "Ver"}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted">
                  Nenhuma conta encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted">
          MRR total das contas:{" "}
          <span className="font-semibold text-ink">
            R$ {formatNumber(mrrTotal)}/mês
          </span>
        </span>
        <button className="inline-flex items-center gap-1 text-xs font-medium text-brand-300 hover:text-brand-200">
          Como o score é calculado?
        </button>
      </div>
    </div>
  );
}
