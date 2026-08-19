"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { NpsEntry } from "@/lib/data/nps";

const CLASS_META: Record<NpsEntry["classification"], { label: string; chip: string }> = {
  promotor: { label: "Promotor", chip: "bg-emerald-500/15 text-emerald-600" },
  neutro: { label: "Neutro", chip: "bg-amber-500/15 text-amber-600" },
  detrator: { label: "Detrator", chip: "bg-rose-500/15 text-rose-500" },
};

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

type Summary = { total: number; promoters: number; detractors: number; neutros: number; score: number };

export function NpsOverview({ entries, summary }: { entries: NpsEntry[]; summary: Summary }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"todos" | NpsEntry["classification"]>("todos");

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter !== "todos" && e.classification !== filter) return false;
      if (!needle) return true;
      return (
        e.clientName.toLowerCase().includes(needle) ||
        e.comment.toLowerCase().includes(needle) ||
        e.extra.some((a) => a.value.toLowerCase().includes(needle))
      );
    });
  }, [entries, q, filter]);

  const scoreTone = summary.score >= 50 ? "text-emerald-600" : summary.score >= 0 ? "text-amber-600" : "text-rose-500";

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs text-muted">NPS geral</p>
          <p className={cn("text-3xl font-bold", scoreTone)}>{summary.score}</p>
          <p className="text-[11px] text-muted">{summary.total} resposta(s)</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Promotores (9–10)</p>
          <p className="text-2xl font-bold text-emerald-600">{summary.promoters}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Neutros (7–8)</p>
          <p className="text-2xl font-bold text-amber-600">{summary.neutros}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted">Detratores (0–6)</p>
          <p className="text-2xl font-bold text-rose-500">{summary.detractors}</p>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por cliente, comentário…"
            className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
        <div className="flex gap-1.5">
          {(["todos", "promotor", "neutro", "detrator"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={cn(
                "rounded-lg px-2.5 py-1.5 text-xs font-medium",
                filter === k ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:text-ink",
              )}
            >
              {k === "todos" ? "Todos" : CLASS_META[k].label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nenhuma resposta de NPS ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Nota</th>
                  <th className="px-4 py-2.5">Classificação</th>
                  <th className="px-4 py-2.5">Comentário / respostas</th>
                  <th className="px-4 py-2.5">Canal</th>
                  <th className="px-4 py-2.5">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-ink">{e.clientName}</td>
                    <td className="px-4 py-3 font-bold text-ink">{e.score}</td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", CLASS_META[e.classification].chip)}>
                        {CLASS_META[e.classification].label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-ink/90">
                      {e.comment && <p className="whitespace-pre-wrap">{e.comment}</p>}
                      {e.extra.length > 0 && (
                        <ul className="mt-1 space-y-0.5 text-xs text-muted">
                          {e.extra.map((a, i) => (
                            <li key={i}><span className="font-medium text-ink/80">{a.label}:</span> {a.value}</li>
                          ))}
                        </ul>
                      )}
                      {!e.comment && e.extra.length === 0 && <span className="text-muted">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{e.channel || "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted">{fmtDate(e.date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
