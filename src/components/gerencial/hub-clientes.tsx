"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LayoutGrid,
  List,
  Plus,
  Search,
} from "lucide-react";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn, formatNumber } from "@/lib/utils";
import {
  RESPONSIBLE_ROLES,
  type HubClientOps,
  type HubSemaforo,
} from "@/lib/data/operacao";

type Scope = "meus" | "squad" | "todos";
type EstadoFilter = "todas" | "em-dia" | "atrasado" | "aguardando" | "le-pendente";

const SEMAFORO: Record<HubSemaforo["state"], { label: string; chip: string; icon: typeof CheckCircle2 }> = {
  "em-dia": { label: "Em dia", chip: "bg-emerald-500/15 text-emerald-600", icon: CheckCircle2 },
  atrasado: { label: "Atrasado", chip: "bg-rose-500/15 text-rose-500", icon: AlertTriangle },
  aguardando: { label: "Aguardando cliente", chip: "bg-amber-500/15 text-amber-600", icon: Clock3 },
};

function initials(name: string) {
  return name.split(" ").filter((w) => w.length > 1).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

const AVATAR_BG = ["bg-brand-500", "bg-emerald-500", "bg-violet-500", "bg-sky-500", "bg-amber-500", "bg-rose-500"];

function ClientAvatar({ name, idx }: { name: string; idx: number }) {
  return (
    <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white", AVATAR_BG[idx % AVATAR_BG.length])}>
      {initials(name)}
    </span>
  );
}

function RespRow({ c }: { c: HubClientOps }) {
  return (
    <div className="flex items-center gap-1">
      {RESPONSIBLE_ROLES.map((r) => {
        const name = c.responsibles[r.key];
        if (!name) return null;
        return (
          <span
            key={r.key}
            title={`${r.label}: ${name}`}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-surface bg-subtle-strong text-[9px] font-bold text-ink"
          >
            {initials(name)}
          </span>
        );
      })}
    </div>
  );
}

function Semaforo({ s }: { s: HubSemaforo }) {
  const meta = SEMAFORO[s.state];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold", meta.chip)}>
      <Icon className="h-3.5 w-3.5" /> {meta.label}
    </span>
  );
}

export function HubClientes({ clients, meName }: { clients: HubClientOps[]; meName?: string }) {
  const [layout, setLayout] = usePersistentState<"card" | "lista">("vio-hub-layout", "card");
  const [scope, setScope] = useState<Scope>("squad");
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState<EstadoFilter>("todas");
  const [resp, setResp] = useState<string>("");
  const [plan, setPlan] = useState<string>("");

  const meFirst = meName?.split(" ")[0].toLowerCase();
  const isMine = (c: HubClientOps) =>
    !!meFirst && Object.values(c.responsibles).some((n) => n.toLowerCase().includes(meFirst));

  const respNames = useMemo(
    () => [...new Set(clients.flatMap((c) => Object.values(c.responsibles)))].sort(),
    [clients],
  );

  const filtered = useMemo(
    () =>
      clients.filter((c) => {
        if (scope === "meus" && !isMine(c)) return false;
        if (query && !c.name.toLowerCase().includes(query.toLowerCase())) return false;
        if (estado === "em-dia" && c.semaforo.state !== "em-dia") return false;
        if (estado === "atrasado" && c.semaforo.state !== "atrasado") return false;
        if (estado === "aguardando" && c.semaforo.state !== "aguardando") return false;
        if (estado === "le-pendente" && c.leNextMonth.status !== "pendente") return false;
        if (resp && !Object.values(c.responsibles).includes(resp)) return false;
        if (plan && c.plan !== plan) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, scope, query, estado, resp, plan, meFirst],
  );

  return (
    <div className="space-y-4">
      {/* Ações de topo (HUB05) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente"
            className="w-full rounded-xl border border-line bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
        <div className="inline-flex rounded-xl border border-line bg-surface p-0.5">
          {(["meus", "squad", "todos"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors", scope === s ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="inline-flex rounded-xl border border-line bg-surface p-0.5">
          <button onClick={() => setLayout("card")} className={cn("rounded-lg p-1.5", layout === "card" ? "bg-subtle text-ink" : "text-muted")} title="Cards">
            <LayoutGrid className="h-4 w-4" />
          </button>
          <button onClick={() => setLayout("lista")} className={cn("rounded-lg p-1.5", layout === "lista" ? "bg-subtle text-ink" : "text-muted")} title="Lista">
            <List className="h-4 w-4" />
          </button>
        </div>
        <button className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Novo cliente
        </button>
      </div>

      {/* Filtros operacionais (HUB03) */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={estado} onChange={(e) => setEstado(e.target.value as EstadoFilter)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400">
          <option value="todas">Todos os estados</option>
          <option value="em-dia">Em dia</option>
          <option value="atrasado">Com atraso</option>
          <option value="aguardando">Aguardando cliente</option>
          <option value="le-pendente">LE pendente</option>
        </select>
        <select value={resp} onChange={(e) => setResp(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400">
          <option value="">Todos responsáveis</option>
          {respNames.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400">
          <option value="">Todos os planos</option>
          {["Social Pro", "Tráfego + Social", "Full Service"].map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <span className="text-xs text-muted">{filtered.length} cliente(s)</span>
      </div>

      {layout === "card" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c, i) => (
            <Link key={c.id} href={`/gerencial/clientes/${c.id}`} className="block">
              <div className="h-full rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start gap-3">
                  <ClientAvatar name={c.name} idx={i} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{c.name}</p>
                    <p className="text-xs text-muted">{c.plan} · R$ {formatNumber(c.mrr)}/mês</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {c.services.map((s) => (
                    <span key={s} className="rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted">{s}</span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                  <RespRow c={c} />
                  <span className="text-[10px] text-muted">{c.squadName}</span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Semaforo s={c.semaforo} />
                  <span className="text-[11px]">
                    {c.semaforo.late > 0 && <span className="text-rose-500">{c.semaforo.late} atrasada(s) </span>}
                    {c.semaforo.approval > 0 && <span className="text-amber-600">· {c.semaforo.approval} aguardando</span>}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted">
                  LE próx. mês:{" "}
                  <span className={c.leNextMonth.status === "montada" ? "text-emerald-600" : "text-amber-600"}>
                    {c.leNextMonth.status === "montada" ? "montada" : "pendente"}
                  </span>{" "}· {c.nextAgenda}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-3 py-2.5">Cliente</th>
                <th className="px-3 py-2.5">Plano / fee</th>
                <th className="px-3 py-2.5">Responsáveis</th>
                <th className="px-3 py-2.5">Semáforo</th>
                <th className="px-3 py-2.5 text-right">Atrasadas</th>
                <th className="px-3 py-2.5 text-right">Aguardando</th>
                <th className="px-3 py-2.5">LE próx.</th>
                <th className="px-3 py-2.5">Próxima agenda</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-line/60 hover:bg-subtle">
                  <td className="px-3 py-2.5">
                    <Link href={`/gerencial/clientes/${c.id}`} className="font-medium text-ink hover:text-brand-600">{c.name}</Link>
                    <p className="text-[10px] text-muted">{c.squadName}</p>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{c.plan} · R$ {formatNumber(c.mrr)}</td>
                  <td className="px-3 py-2.5"><RespRow c={c} /></td>
                  <td className="px-3 py-2.5"><Semaforo s={c.semaforo} /></td>
                  <td className="px-3 py-2.5 text-right">{c.semaforo.late || "—"}</td>
                  <td className="px-3 py-2.5 text-right">{c.semaforo.approval || "—"}</td>
                  <td className="px-3 py-2.5">
                    <span className={c.leNextMonth.status === "montada" ? "text-emerald-600" : "text-amber-600"}>
                      {c.leNextMonth.status}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-muted">{c.nextAgenda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filtered.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line py-10 text-center text-sm text-muted">
          Nenhum cliente neste escopo/filtro.
        </p>
      )}
    </div>
  );
}
