"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Link2,
  Loader2,
  Presentation,
  Send,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getReportHistory,
  REPORT_INTEGRATIONS,
  REPORT_ORGANIC_METRICS,
  REPORT_PAID_METRICS,
} from "@/lib/data/operacao";
import {
  resolveReportSummary,
  organicValue,
  paidValue,
} from "@/lib/data/reports";

type DocType = "apresentacao" | "planilha" | "link";
type ClientOpt = { id: string; name: string };

const DOC_TYPES: { key: DocType; label: string; sub: string; icon: typeof FileText }[] = [
  { key: "apresentacao", label: "Apresentação", sub: "PDF estilizado · Doc B", icon: Presentation },
  { key: "planilha", label: "Planilha", sub: "Dados brutos · Excel", icon: FileSpreadsheet },
  { key: "link", label: "Link público", sub: "Dashboard online", icon: Link2 },
];

function MetricGroup({
  title,
  metrics,
  selected,
  onToggle,
  onAll,
}: {
  title: string;
  metrics: readonly { key: string; label: string }[];
  selected: Set<string>;
  onToggle: (key: string) => void;
  onAll: () => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
        <button onClick={onAll} className="text-xs font-medium text-brand-300 hover:text-brand-200">
          Selecionar todas
        </button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {metrics.map((m) => {
          const on = selected.has(m.key);
          return (
            <button
              key={m.key}
              onClick={() => onToggle(m.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs font-medium transition-colors",
                on ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line bg-surface text-muted hover:text-ink",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  on ? "border-brand-400 bg-brand-500 text-white" : "border-line",
                )}
              >
                {on && <CheckCircle2 className="h-3 w-3" />}
              </span>
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RelatoriosCentral({ clients }: { clients: ClientOpt[] }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [organic, setOrganic] = useState<Set<string>>(new Set(REPORT_ORGANIC_METRICS.map((m) => m.key)));
  const [paid, setPaid] = useState<Set<string>>(new Set(REPORT_PAID_METRICS.map((m) => m.key)));
  const [docType, setDocType] = useState<DocType>("apresentacao");
  const [period, setPeriod] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rótulo do mês atual via new Date() só no cliente (SSR-safe)
    setPeriod(new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date()));
  }, []);

  const client = clients.find((c) => c.id === clientId);
  const summary = resolveReportSummary(clientId || "seed");
  const history = getReportHistory();

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

  function selectedMetrics() {
    return [
      ...REPORT_ORGANIC_METRICS.filter((m) => organic.has(m.key)).map((m) => ({
        label: m.label,
        value: organicValue(m.key, summary),
      })),
      ...REPORT_PAID_METRICS.filter((m) => paid.has(m.key)).map((m) => ({
        label: m.label,
        value: paidValue(m.key, summary),
      })),
    ];
  }

  async function sendPdf() {
    if (!clientId || sending) return;
    setSending(true);
    setStatus(null);
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, period, metrics: selectedMetrics() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      setStatus({
        ok: true,
        text: json.sent
          ? json.mode === "pdf"
            ? "Relatório (PDF) enviado no WhatsApp do cliente."
            : "Enviado como texto (PDF indisponível)."
          : "Registrado (WhatsApp não configurado).",
      });
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : "erro" });
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Configuração */}
      <Card className="space-y-5 p-5">
        <h2 className="text-sm font-semibold text-ink">Configurar relatório</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Cliente</label>
            <select
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value);
                setStatus(null);
              }}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
            >
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Período de referência</label>
            <input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
        </div>

        <MetricGroup
          title="Métricas orgânicas"
          metrics={REPORT_ORGANIC_METRICS}
          selected={organic}
          onToggle={(k) => setOrganic((s) => toggle(s, k))}
          onAll={() => setOrganic(new Set(REPORT_ORGANIC_METRICS.map((m) => m.key)))}
        />

        <MetricGroup
          title="Métricas de mídia paga"
          metrics={REPORT_PAID_METRICS}
          selected={paid}
          onToggle={(k) => setPaid((s) => toggle(s, k))}
          onAll={() => setPaid(new Set(REPORT_PAID_METRICS.map((m) => m.key)))}
        />

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Tipo de documento</h4>
          <div className="grid grid-cols-3 gap-2">
            {DOC_TYPES.map((d) => {
              const Icon = d.icon;
              const on = docType === d.key;
              return (
                <button
                  key={d.key}
                  onClick={() => setDocType(d.key)}
                  className={cn(
                    "rounded-xl border p-3 text-center transition-colors",
                    on ? "border-brand-400 bg-brand-500/10" : "border-line bg-surface hover:border-brand-300",
                  )}
                >
                  <Icon className={cn("mx-auto h-5 w-5", on ? "text-brand-300" : "text-muted")} />
                  <p className="mt-1.5 text-xs font-medium text-ink">{d.label}</p>
                  <p className="text-[10px] text-muted">{d.sub}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Status das integrações</h4>
          <ul className="space-y-1.5">
            {REPORT_INTEGRATIONS.map((it) => (
              <li key={it.name} className="flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-sm">
                <span className="text-ink">{it.name}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-medium",
                    it.status === "ok" ? "text-emerald-400" : "text-amber-400",
                  )}
                >
                  {it.status === "ok" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <TriangleAlert className="h-3.5 w-3.5" />}
                  {it.note}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button
          onClick={sendPdf}
          disabled={sending || !clientId || (organic.size === 0 && paid.size === 0)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar relatório por WhatsApp (PDF)
        </button>
        {status && (
          <p className={cn("rounded-lg px-3 py-2 text-center text-xs", status.ok ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
            {status.text}
          </p>
        )}
      </Card>

      {/* Preview + histórico */}
      <div className="space-y-4">
        <Card className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-ink">Preview do documento</h2>
            <FileText className="h-4 w-4 text-muted" />
          </div>

          <div className="rounded-xl border border-line bg-canvas p-4">
            <p className="text-xs text-muted">Resultados — {period}</p>
            <p className="text-base font-bold text-ink">{client?.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {["Instagram", "Meta Ads", "Google Ads"].map((t) => (
                <span key={t} className="rounded-full bg-subtle-strong px-2 py-0.5 text-[10px] font-medium text-muted">
                  {t}
                </span>
              ))}
            </div>

            {organic.size > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Resumo orgânico</p>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_ORGANIC_METRICS.filter((m) => organic.has(m.key)).map((m) => (
                    <div key={m.key} className="rounded-lg bg-surface p-2.5">
                      <p className="text-sm font-bold text-ink">{organicValue(m.key, summary)}</p>
                      <p className="text-[10px] text-muted">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {paid.size > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Mídia paga</p>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_PAID_METRICS.filter((m) => paid.has(m.key)).map((m) => (
                    <div key={m.key} className="rounded-lg bg-surface p-2.5">
                      <p className="text-sm font-bold text-ink">{paidValue(m.key, summary)}</p>
                      <p className="text-[10px] text-muted">{m.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="mt-4 text-center text-[10px] text-muted">
              As métricas marcadas acima são exatamente as que vão no PDF.
            </p>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink">Histórico de relatórios gerados</h2>
          <ul className="divide-y divide-line">
            {history.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-sm text-ink">{h.client}</p>
                  <p className="text-xs text-muted">{h.period} · {h.kind}</p>
                </div>
                <button className="text-xs font-medium text-brand-300 hover:text-brand-200">Baixar</button>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
