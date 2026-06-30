"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  List,
  Plus,
  Rocket,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn, formatNumber } from "@/lib/utils";
import { HUB_PLANS, type HubClient, type HubPlan } from "@/lib/data/operacao";

type StatusFilter = "todos" | "ativo" | "onboarding" | "risco";

function initials(name: string) {
  return name
    .split(" ")
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function healthTone(score: number) {
  if (score >= 80) return { text: "text-emerald-400", bar: "bg-emerald-400" };
  if (score >= 50) return { text: "text-amber-400", bar: "bg-amber-400" };
  return { text: "text-rose-400", bar: "bg-rose-400" };
}

const AVATAR_BG = [
  "bg-brand-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-sky-500",
  "bg-amber-500",
  "bg-rose-500",
];

function Avatar({ name, idx }: { name: string; idx: number }) {
  return (
    <span
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white",
        AVATAR_BG[idx % AVATAR_BG.length],
      )}
    >
      {initials(name)}
    </span>
  );
}

function StatusBadges({ client }: { client: HubClient }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {client.status === "onboarding" ? (
        <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-medium text-sky-300">
          Em onboarding
        </span>
      ) : client.atRisk ? (
        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-300">
          Risco churn
        </span>
      ) : (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
          Ativo
        </span>
      )}
      <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[11px] font-medium text-muted">
        {client.plan}
      </span>
    </div>
  );
}

function HealthBlock({ client }: { client: HubClient }) {
  if (client.onboarding) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="flex items-center gap-1 text-sm font-semibold text-ink">
            <Rocket className="h-3.5 w-3.5 text-sky-300" />
            {client.onboarding.step}/{client.onboarding.total}
          </p>
          <p className="text-[11px] text-muted">VioLaunch</p>
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">
            {client.onboarding.startDate}
          </p>
          <p className="text-[11px] text-muted">Início</p>
        </div>
      </div>
    );
  }
  const tone = healthTone(client.healthScore);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <p className={cn("text-sm font-semibold", tone.text)}>
          {client.healthScore}
        </p>
        <p className="text-[11px] text-muted">Score saúde</p>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-subtle-strong">
          <div
            className={cn("h-full rounded-full", tone.bar)}
            style={{ width: `${client.healthScore}%` }}
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">{client.nps}</p>
        <p className="text-[11px] text-muted">NPS</p>
      </div>
    </div>
  );
}

export function HubClientes({ clients }: { clients: HubClient[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("todos");
  const [plan, setPlan] = useState<HubPlan | null>(null);
  const [view, setView] = usePersistentState<"cards" | "lista">(
    "vio-hub-view",
    "cards",
  );

  const counts = useMemo(
    () => ({
      todos: clients.length,
      ativo: clients.filter((c) => c.status === "ativo").length,
      onboarding: clients.filter((c) => c.status === "onboarding").length,
      risco: clients.filter((c) => c.atRisk).length,
    }),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clients.filter((c) => {
      if (q && !`${c.name} ${c.segment} ${c.city}`.toLowerCase().includes(q))
        return false;
      if (status === "risco" && !c.atRisk) return false;
      if (status === "ativo" && c.status !== "ativo") return false;
      if (status === "onboarding" && c.status !== "onboarding") return false;
      if (plan && c.plan !== plan) return false;
      return true;
    });
  }, [clients, query, status, plan]);

  const STATUS_TABS: { key: StatusFilter; label: string; n: number }[] = [
    { key: "todos", label: "Todos", n: counts.todos },
    { key: "ativo", label: "Ativos", n: counts.ativo },
    { key: "onboarding", label: "Em onboarding", n: counts.onboarding },
    { key: "risco", label: "Risco churn", n: counts.risco },
  ];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente…"
            className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
        <div className="flex items-center rounded-xl border border-line bg-surface p-0.5">
          <button
            onClick={() => setView("cards")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
              view === "cards" ? "bg-subtle text-ink" : "text-muted",
            )}
          >
            <LayoutGrid className="h-4 w-4" /> Cards
          </button>
          <button
            onClick={() => setView("lista")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium",
              view === "lista" ? "bg-subtle text-ink" : "text-muted",
            )}
          >
            <List className="h-4 w-4" /> Lista
          </button>
        </div>
        <button
          onClick={() => setPlan(null)}
          className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle"
        >
          <SlidersHorizontal className="h-4 w-4" /> Filtros
        </button>
        <button className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </div>

      {/* Filtros: status */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Status:
        </span>
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setStatus(t.key)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              status === t.key
                ? "bg-brand-500 text-white"
                : "bg-surface text-muted hover:text-ink",
            )}
          >
            {t.label} ({t.n})
          </button>
        ))}
      </div>

      {/* Filtros: plano */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          Plano:
        </span>
        {HUB_PLANS.map((p) => (
          <button
            key={p}
            onClick={() => setPlan(plan === p ? null : p)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              plan === p
                ? "bg-ink text-surface"
                : "bg-surface text-muted hover:text-ink",
            )}
          >
            {p}
          </button>
        ))}
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {status === "todos" ? "Todos os clientes" : "Clientes filtrados"} ·{" "}
        {filtered.length}
      </p>

      {/* Conteúdo */}
      {view === "cards" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <Link
              key={c.id}
              href={`/gerencial/clientes/${c.id}`}
              className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-brand-300"
            >
              <div className="mb-3 flex items-start gap-3">
                <Avatar name={c.name} idx={i} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">
                    {c.name}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {c.segment} · {c.city}
                  </p>
                </div>
              </div>
              <div className="mb-3">
                <StatusBadges client={c} />
              </div>
              <HealthBlock client={c} />
              <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-xs">
                <span className="text-muted">{c.responsavel}</span>
                <span className="font-medium text-ink">
                  R$ {formatNumber(c.mrr)}/mês
                </span>
              </div>
            </Link>
          ))}

          {/* Novo cliente */}
          <button className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-line text-muted transition-colors hover:border-brand-300 hover:text-brand-300">
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Novo cliente</span>
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Plano</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Saúde</th>
                <th className="px-4 py-3 font-medium">NPS</th>
                <th className="px-4 py-3 font-medium">CS</th>
                <th className="px-4 py-3 text-right font-medium">Mensal</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c, i) => {
                const tone = healthTone(c.healthScore);
                return (
                  <tr
                    key={c.id}
                    className="border-b border-line last:border-0 hover:bg-subtle"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/gerencial/clientes/${c.id}`}
                        className="flex items-center gap-2"
                      >
                        <Avatar name={c.name} idx={i} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink">
                            {c.name}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {c.segment} · {c.city}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted">{c.plan}</td>
                    <td className="px-4 py-3">
                      <StatusBadges client={c} />
                    </td>
                    <td className={cn("px-4 py-3 font-semibold", tone.text)}>
                      {c.onboarding
                        ? `${c.onboarding.step}/${c.onboarding.total}`
                        : c.healthScore}
                    </td>
                    <td className="px-4 py-3 text-ink">{c.nps}</td>
                    <td className="px-4 py-3 text-muted">{c.responsavel}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink">
                      R$ {formatNumber(c.mrr)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
