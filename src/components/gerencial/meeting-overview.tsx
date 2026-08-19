"use client";

import { useMemo, useState } from "react";
import { Search, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { MeetingEntry } from "@/lib/data/meeting-survey";

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn("h-3.5 w-3.5", s <= n ? "fill-amber-400 text-amber-400" : "text-line")} />
      ))}
    </span>
  );
}

type Summary = { total: number; avg: number; dist: { star: number; count: number }[] };

export function MeetingOverview({ entries, summary }: { entries: MeetingEntry[]; summary: Summary }) {
  const [q, setQ] = useState("");
  const [min, setMin] = useState<0 | 1 | 2 | 3 | 4 | 5>(0);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (min && e.rating < min) return false;
      if (!needle) return true;
      return (
        e.clientName.toLowerCase().includes(needle) ||
        e.comment.toLowerCase().includes(needle) ||
        e.extra.some((a) => a.value.toLowerCase().includes(needle))
      );
    });
  }, [entries, q, min]);

  const avgTone = summary.avg >= 4 ? "text-emerald-600" : summary.avg >= 3 ? "text-amber-600" : "text-rose-500";

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted">Média das reuniões</p>
          <p className={cn("flex items-center gap-2 text-3xl font-bold", avgTone)}>
            {summary.avg.toFixed(1)} <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
          </p>
          <p className="text-[11px] text-muted">{summary.total} avaliação(ões)</p>
        </Card>
        <Card className="p-4 sm:col-span-2">
          <p className="mb-2 text-xs text-muted">Distribuição</p>
          <div className="space-y-1">
            {[...summary.dist].reverse().map((d) => {
              const pct = summary.total ? Math.round((d.count / summary.total) * 100) : 0;
              return (
                <div key={d.star} className="flex items-center gap-2 text-xs">
                  <span className="flex w-8 items-center gap-0.5 text-muted">{d.star}<Star className="h-3 w-3 fill-amber-400 text-amber-400" /></span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-8 text-right text-muted">{d.count}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por cliente, comentário…" className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400" />
        </div>
        <div className="flex gap-1.5">
          {([0, 5, 4, 3] as const).map((k) => (
            <button key={k} onClick={() => setMin(k)} className={cn("rounded-lg px-2.5 py-1.5 text-xs font-medium", min === k ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:text-ink")}>
              {k === 0 ? "Todas" : `${k}★+`}
            </button>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nenhuma avaliação de reunião ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-[11px] font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-2.5">Cliente</th>
                  <th className="px-4 py-2.5">Avaliação</th>
                  <th className="px-4 py-2.5">Comentário / respostas</th>
                  <th className="px-4 py-2.5">Canal</th>
                  <th className="px-4 py-2.5">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-4 py-3 font-medium text-ink">{e.clientName}</td>
                    <td className="px-4 py-3"><Stars n={e.rating} /></td>
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
