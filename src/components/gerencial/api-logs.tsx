"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronDown, Clock, RefreshCw, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ApiLogRow, ApiLogsData } from "@/lib/data/api-logs-server";

const PERIODOS = [
  { key: 1, label: "24h" },
  { key: 7, label: "7 dias" },
  { key: 30, label: "30 dias" },
  { key: 0, label: "Tudo" },
];

function statusTone(status: number): string {
  if (status >= 500) return "bg-rose-500/15 text-rose-700";
  if (status >= 400) return "bg-amber-500/15 text-amber-700";
  if (status >= 200 && status < 300) return "bg-emerald-500/15 text-emerald-700";
  return "bg-subtle text-muted";
}

function fmtHora(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function LinhaLog({ log }: { log: ApiLogRow }) {
  const [aberto, setAberto] = useState(false);
  const temDetalhe = Boolean(log.error || log.userAgent || log.ip || log.actor);
  return (
    <li className={cn(!log.ok && "bg-rose-500/[0.03]")}>
      <button
        onClick={() => temDetalhe && setAberto((v) => !v)}
        className={cn("flex w-full items-center gap-3 px-4 py-2 text-left", temDetalhe && "hover:bg-subtle")}
      >
        <span className="shrink-0">
          {log.ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-500" />}
        </span>
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-bold", statusTone(log.status))}>
          {log.status || "—"}
        </span>
        <span className="w-14 shrink-0 font-mono text-[11px] font-semibold text-muted">{log.method}</span>
        <code className="min-w-0 flex-1 truncate text-xs text-ink">{log.path}</code>
        <span className="hidden shrink-0 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted sm:block">
          {log.source}
        </span>
        <span className="hidden w-16 shrink-0 text-right text-[11px] text-muted md:block">{log.durationMs} ms</span>
        <span className="w-32 shrink-0 text-right text-[11px] text-muted">{fmtHora(log.createdAt)}</span>
        {temDetalhe && <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 text-muted transition-transform", aberto && "rotate-180")} />}
      </button>
      {aberto && (
        <div className="space-y-1 border-t border-line bg-canvas px-4 py-2.5 text-xs">
          {log.error && (
            <p className="text-rose-600">
              <span className="font-semibold">Erro:</span> {log.error}
            </p>
          )}
          {log.actor && <p className="text-muted"><span className="font-semibold text-ink">Usuário:</span> {log.actor}</p>}
          {log.ip && <p className="text-muted"><span className="font-semibold text-ink">IP:</span> {log.ip}</p>}
          {log.userAgent && <p className="break-all text-muted"><span className="font-semibold text-ink">User-Agent:</span> {log.userAgent}</p>}
        </div>
      )}
    </li>
  );
}

export function ApiLogs({ data, days, source, onlyErrors }: { data: ApiLogsData; days: number; source: string; onlyErrors: boolean }) {
  const router = useRouter();
  const params = useSearchParams();

  function setFiltro(patch: Record<string, string | null>) {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") q.delete(k);
      else q.set(k, v);
    }
    router.push(`/gerencial/logs?${q.toString()}`);
  }

  if (data.semTabela) {
    return (
      <Card className="p-6 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
        <p className="mt-2 text-sm font-semibold text-ink">Tabela de logs ainda não existe</p>
        <p className="mt-1 text-xs text-muted">
          Rode a migração <code className="rounded bg-subtle px-1">0129_api_logs.sql</code> para começar a registrar as chamadas.
        </p>
      </Card>
    );
  }

  const { resumo } = data;
  const maxDia = Math.max(1, ...resumo.porDia.map((d) => d.total));

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-sm">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                onClick={() => setFiltro({ days: String(p.key) })}
                className={cn("px-3 py-1.5 font-medium", days === p.key ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}
              >
                {p.label}
              </button>
            ))}
          </div>
          <select
            value={source}
            onChange={(e) => setFiltro({ source: e.target.value || null })}
            className="h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="">Todas as origens</option>
            {data.sources.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={onlyErrors}
              onChange={(e) => setFiltro({ errors: e.target.checked ? "1" : null })}
              className="h-4 w-4 accent-rose-500"
            />
            Só erros
          </label>
        </div>
        <button onClick={() => router.refresh()} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Chamadas</p><p className="mt-1 text-2xl font-bold text-ink">{resumo.total}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Erros</p><p className={cn("mt-1 text-2xl font-bold", resumo.erros > 0 ? "text-rose-600" : "text-ink")}>{resumo.erros}</p></Card>
        <Card className="p-4"><p className="text-xs uppercase tracking-wide text-muted">Taxa de erro</p><p className={cn("mt-1 text-2xl font-bold", resumo.taxaErro >= 10 ? "text-rose-600" : resumo.taxaErro > 0 ? "text-amber-600" : "text-emerald-600")}>{resumo.taxaErro}%</p></Card>
        <Card className="p-4"><p className="inline-flex items-center gap-1 text-xs uppercase tracking-wide text-muted"><Clock className="h-3 w-3" /> Duração média</p><p className="mt-1 text-2xl font-bold text-ink">{resumo.duracaoMedia} ms</p></Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Por origem */}
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Por origem</p>
          {resumo.porFonte.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Sem chamadas no período.</p>
          ) : (
            <div className="space-y-2.5">
              {resumo.porFonte.map((f) => {
                const pctErro = f.total > 0 ? Math.round((f.erros / f.total) * 100) : 0;
                return (
                  <div key={f.source}>
                    <div className="flex items-center justify-between text-sm">
                      <button onClick={() => setFiltro({ source: f.source })} className="truncate font-medium text-ink hover:text-brand-600">{f.source}</button>
                      <span className="shrink-0 text-xs text-muted">{f.total}{f.erros > 0 && <span className="ml-1 text-rose-600">· {f.erros} erro(s)</span>}</span>
                    </div>
                    <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-subtle">
                      <div className="h-full bg-emerald-500" style={{ width: `${100 - pctErro}%` }} />
                      <div className="h-full bg-rose-400" style={{ width: `${pctErro}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Por dia */}
        <Card className="p-5">
          <p className="mb-3 text-sm font-semibold text-ink">Por dia</p>
          {resumo.porDia.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted">Sem dados.</p>
          ) : (
            <>
              <div className="flex h-32 items-end gap-1.5">
                {resumo.porDia.map((d) => {
                  const h = Math.round((d.total / maxDia) * 100);
                  const pctOk = d.total > 0 ? Math.round(((d.total - d.erros) / d.total) * 100) : 0;
                  return (
                    <div key={d.dia} className="flex flex-1 flex-col items-center gap-1" title={`${d.dia}: ${d.total} chamadas, ${d.erros} erro(s)`}>
                      <div className="flex w-full flex-col justify-end overflow-hidden rounded-t bg-subtle" style={{ height: `${Math.max(3, h)}%` }}>
                        <div className="w-full bg-rose-400" style={{ height: `${100 - pctOk}%` }} />
                        <div className="w-full bg-emerald-500" style={{ height: `${pctOk}%` }} />
                      </div>
                      <span className="text-[9px] text-muted">{d.dia.slice(8)}/{d.dia.slice(5, 7)}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex items-center gap-3 text-[11px] text-muted">
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> OK</span>
                <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-400" /> Erro</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Lista */}
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <p className="text-sm font-semibold text-ink">Chamadas ({data.logs.length})</p>
          <p className="text-[11px] text-muted">clique numa linha para ver o detalhe</p>
        </div>
        {data.logs.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Nenhuma chamada registrada com esses filtros.</p>
        ) : (
          <ul className="divide-y divide-line">
            {data.logs.map((log) => <LinhaLog key={log.id} log={log} />)}
          </ul>
        )}
      </Card>
    </div>
  );
}
