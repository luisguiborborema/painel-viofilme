"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BellRing,
  Loader2,
  Pause,
  Play,
  Plus,

  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import {
  UPDATE_METRICS,
  WEEKDAYS,
  buildUpdateMessage,
  metricLabel,
  recurrenceLabel,
  type RecurringUpdate,
  type UpdateMetric,
} from "@/lib/data/recurring";

type ClientOpt = { id: string; name: string };
type Send = {
  id: string;
  clientName?: string;
  kind: string;
  channel: string;
  sentBy?: string;
  detail?: string;
  createdAt: string;
};

export function ReportsAutomation({ clients }: { clients: ClientOpt[] }) {
  const [updates, setUpdates] = useState<RecurringUpdate[]>([]);
  const [sends, setSends] = useState<Send[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    const [u, s] = await Promise.all([
      fetch("/api/gerencial/recurring-updates", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/reports/send", { cache: "no-store" }).then((r) => r.json()),
    ]);
    setUpdates(u.updates ?? []);
    setSends(s.sends ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial; reload() atualiza estado internamente
    reload().finally(() => setLoading(false));
  }, []);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <NewUpdate clients={clients} onCreated={reload} />
      <div className="space-y-4">
        <UpdatesList updates={updates} loading={loading} onChange={reload} />
        <SendsHistory sends={sends} />
      </div>
    </div>
  );
}

// ── REL02 — novo update recorrente ───────────────────────────────────────────

function NewUpdate({ clients, onCreated }: { clients: ClientOpt[]; onCreated: () => void }) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [metrics, setMetrics] = useState<UpdateMetric[]>(["followers_growth"]);
  const [kind, setKind] = useState<"daily" | "weekly" | "monthly">("weekly");
  const [weekday, setWeekday] = useState(3); // quarta
  const [monthday, setMonthday] = useState(1);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  const recurrence =
    kind === "daily" ? "daily" : kind === "weekly" ? `weekly:${weekday}` : `monthly:${monthday}`;

  const client = clients.find((c) => c.id === clientId);
  const preview = useMemo(
    () => (client && metrics.length ? buildUpdateMessage(client.name, client.id, metrics) : ""),
    [client, metrics],
  );

  function toggleMetric(m: UpdateMetric) {
    setOk(false);
    setMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function create() {
    if (!clientId || metrics.length === 0 || busy) return;
    setBusy(true);
    setOk(false);
    try {
      const res = await fetch("/api/gerencial/recurring-updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", clientId, metrics, recurrence }),
      });
      if (res.ok) {
        setOk(true);
        onCreated();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center gap-2">
        <BellRing className="h-[18px] w-[18px] text-brand-600" />
        <h2 className="text-sm font-semibold text-ink">Novo update recorrente</h2>
      </div>
      <p className="mb-3 text-xs text-muted">
        Uma ou poucas métricas, automático, direto ao WhatsApp do cliente (opt-in).
      </p>

      <label className="mb-1 block text-xs font-medium text-muted">Cliente</label>
      <select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        className="mb-3 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      <label className="mb-1 block text-xs font-medium text-muted">Métricas</label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {UPDATE_METRICS.map((m) => {
          const on = metrics.includes(m.key);
          return (
            <button
              key={m.key}
              onClick={() => toggleMetric(m.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                on ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line text-muted hover:bg-subtle",
              )}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <label className="mb-1 block text-xs font-medium text-muted">Recorrência</label>
      <div className="mb-3 flex flex-wrap gap-2">
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as typeof kind)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        >
          <option value="daily">Diário</option>
          <option value="weekly">Semanal</option>
          <option value="monthly">Mensal</option>
        </select>
        {kind === "weekly" && (
          <select
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          >
            {WEEKDAYS.map((d, i) => (
              <option key={i} value={i}>{d}</option>
            ))}
          </select>
        )}
        {kind === "monthly" && (
          <select
            value={monthday}
            onChange={(e) => setMonthday(Number(e.target.value))}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>Dia {d}</option>
            ))}
          </select>
        )}
      </div>

      {preview && (
        <div className="mb-3 rounded-xl border border-line bg-canvas p-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
            Prévia da mensagem
          </p>
          <p className="whitespace-pre-wrap text-xs text-ink">{preview}</p>
        </div>
      )}

      <button
        onClick={create}
        disabled={busy || metrics.length === 0}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Criar update
      </button>
      {ok && <span className="ml-2 text-xs text-emerald-600">Criado!</span>}
    </Card>
  );
}

// ── Lista de updates ─────────────────────────────────────────────────────────

function UpdatesList({
  updates,
  loading,
  onChange,
}: {
  updates: RecurringUpdate[];
  loading: boolean;
  onChange: () => void;
}) {
  async function toggle(u: RecurringUpdate) {
    await fetch("/api/gerencial/recurring-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id: u.id, status: u.status === "active" ? "paused" : "active" }),
    });
    onChange();
  }
  async function remove(u: RecurringUpdate) {
    await fetch("/api/gerencial/recurring-updates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: u.id }),
    });
    onChange();
  }

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Updates configurados</h2>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : updates.length === 0 ? (
        <p className="rounded-lg bg-subtle px-3 py-6 text-center text-sm text-muted">
          Nenhum update recorrente ainda.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {updates.map((u) => (
            <li key={u.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{u.clientName ?? "Cliente"}</p>
                <p className="text-xs text-muted">
                  {u.metrics.map(metricLabel).join(", ")} · {recurrenceLabel(u.recurrence)}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      u.status === "active" ? "bg-emerald-500/15 text-emerald-600" : "bg-subtle text-muted",
                    )}
                  >
                    {u.status === "active" ? "Ativo" : "Pausado"}
                  </span>
                  {u.lastSentAt && (
                    <span className="text-[10px] text-muted">
                      último: {dayMonth(u.lastSentAt)} {clockLabel(u.lastSentAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  onClick={() => toggle(u)}
                  title={u.status === "active" ? "Pausar" : "Ativar"}
                  className="rounded-lg p-1.5 text-muted hover:bg-subtle"
                >
                  {u.status === "active" ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => remove(u)}
                  title="Remover"
                  className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ── REL06 — histórico de envios ──────────────────────────────────────────────

function SendsHistory({ sends }: { sends: Send[] }) {
  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Histórico de envios</h2>
      {sends.length === 0 ? (
        <p className="rounded-lg bg-subtle px-3 py-6 text-center text-sm text-muted">
          Nenhum envio registrado ainda.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {sends.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">
                  {s.clientName ?? "Cliente"}
                  <span className="ml-1.5 rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">
                    {s.kind === "update" ? "update" : "relatório"}
                  </span>
                </p>
                <p className="text-xs text-muted">
                  {s.detail ?? s.channel} · por {s.sentBy ?? "automático"}
                </p>
              </div>
              <span className="shrink-0 text-[11px] text-muted">
                {dayMonth(s.createdAt)} {clockLabel(s.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
