"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Clock,
  KanbanSquare,
  LayoutDashboard,
  Loader2,
  Pause,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Users,
  UserSquare2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { AvatarStack } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DeliveryFieldsManager } from "./delivery-fields-manager";
import { TaskFicha } from "./linha-editorial";
import { toast } from "@/components/ui/toast";
// TaskUniversal aposentado (C1.1): todas as telas usam a ficha canônica (TaskFicha).
import { cn } from "@/lib/utils";
import {
  DELIVERY_CONFIG_FALLBACK,
  DELIVERY_TODAY_ISO,
  DELIVERY_TODAY_IDX,
  OPS_TEAM,
  TASK_STAGES,
  DELIVERY_PRIORITIES,
  WEEKDAYS,
  type DeliveryConfig,
  type DeliveryPriority,
  type DeliveryTask,
  type TaskOrigin,
  type TaskStage,
  type TaskType,
} from "@/lib/data/operacao";

type View = "geral" | "kanban" | "calendario" | "timeline" | "workload" | "cliente";

const VIEWS: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "geral", label: "Visão geral", icon: LayoutDashboard },
  { key: "kanban", label: "Kanban", icon: KanbanSquare },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "timeline", label: "Linha do tempo", icon: Clock },
  { key: "workload", label: "Workload", icon: Users },
  { key: "cliente", label: "Entregas por cliente", icon: UserSquare2 },
];

// Cores por tipo. Map (não Record) porque o tipo agora pode ser personalizado
// pelos formulários — tipos fora dos padrões caem no fallback neutro.
const TYPE_COLOR = new Map<string, string>([
  ["Arte", "bg-sky-500/15 text-sky-500"],
  ["Vídeo", "bg-rose-500/15 text-rose-500"],
  ["Copy", "bg-violet-500/15 text-violet-500"],
  ["Tráfego", "bg-amber-500/15 text-amber-600"],
]);

const ORIGINS: TaskOrigin[] = ["Linha editorial", "Projeto", "Tarefa avulsa"];
const CLIENT_PALETTE = ["#2a63c9", "#059669", "#d97706", "#7c3aed", "#e11d48", "#0284c7", "#be185d", "#0f766e"];

const memberName = (id: string) => OPS_TEAM.find((m) => m.id === id)?.name ?? id;
const memberInitials = (id: string) => {
  const m = OPS_TEAM.find((x) => x.id === id);
  if (m) return m.initials;
  // Responsável real: iniciais a partir do próprio nome.
  return (
    id
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "?"
  );
};

// ── Métricas / filtros estilo Sprint board ──────────────────────────────────
const TERMINAL_STAGE: TaskStage = "done"; // etapa terminal (= "concluída")
const STUCK_DAYS = 7;
/** Responsáveis do card: array (fonte de verdade) com fallback ao single. */
const respIdsOf = (t: DeliveryTask): string[] =>
  t.assignees?.length ? t.assignees : t.assignee ? [t.assignee] : [];
function daysSinceMove(t: DeliveryTask): number {
  const ref = t.movedAt || t.createdAt;
  return ref ? Math.floor((Date.now() - new Date(ref).getTime()) / 86_400_000) : 0;
}
/** Parada: não-terminal e sem movimentação há STUCK_DAYS+. */
const isStuckTask = (t: DeliveryTask) => t.stage !== TERMINAL_STAGE && daysSinceMove(t) >= STUCK_DAYS;
/** Atrasada: tem prazo, não é terminal e o prazo (por DIA) já passou. */
function isOverdueTask(t: DeliveryTask): boolean {
  if (t.stage === TERMINAL_STAGE || !t.dueDate) return false;
  return new Date(t.dueDate) < new Date(new Date().toDateString());
}

async function postDelivery(body: unknown): Promise<boolean> {
  const res = await fetch("/api/gerencial/delivery-tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  if (!res?.ok) {
    toast("Não foi possível salvar a alteração no Painel de Entregas. Tente de novo.", "error");
    return false;
  }
  return true;
}

async function postConfig(body: unknown): Promise<boolean> {
  const res = await fetch("/api/gerencial/delivery-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return Boolean(res?.ok);
}

// Editor de capacidade (ENT12) + durações por tipo (ENT10). Persiste na config.
function DeliveryConfigModal({
  config,
  onClose,
  onChange,
}: {
  config: DeliveryConfig;
  onClose: () => void;
  onChange: (c: DeliveryConfig) => void;
}) {
  const [cap, setCap] = useState(config.capacityPerDay);
  const [durations, setDurations] = useState<Record<string, number>>(config.typeDurations);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const next: DeliveryConfig = { capacityPerDay: cap, typeDurations: durations };
    await postConfig({ action: "set-capacity", capacityPerDay: cap });
    for (const [type, minutes] of Object.entries(durations)) {
      await postConfig({ action: "set-duration", type, minutes });
    }
    onChange(next);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Capacidade & durações</h3>
          <button onClick={onClose} title="Fechar" aria-label="Fechar" className="text-muted hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <label className="mb-4 block">
          <span className="mb-1 block text-xs font-medium text-muted">Capacidade — tasks/dia por pessoa (ENT12)</span>
          <input
            type="number"
            min={1}
            max={50}
            value={cap}
            onChange={(e) => setCap(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
            className="w-28 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
          />
          <span className="ml-2 text-xs text-muted">alerta: âmbar em {cap + 1}, vermelho em {cap + 2}+</span>
        </label>

        <p className="mb-1 text-xs font-medium text-muted">Duração padrão por tipo — min (ENT10, Timeline)</p>
        <div className="space-y-2">
          {Object.entries(durations).map(([type, min]) => (
            <div key={type} className="flex items-center gap-3">
              <span className="w-20 text-sm text-ink">{type}</span>
              <input
                type="number"
                min={5}
                max={600}
                step={5}
                value={min}
                onChange={(e) =>
                  setDurations((d) => ({ ...d, [type]: Math.max(5, Math.min(600, Number(e.target.value) || 5)) }))
                }
                className="w-24 rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
              />
              <span className="text-xs text-muted">min</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={save} busy={saving}>Salvar</Button>
        </div>
      </div>
    </div>
  );
}

// Métricas de produtividade por pessoa (WIP · concluídas · lead time · atrasadas).
type MetricPeriod = "semana" | "mes" | "tudo";
function inPeriod(iso: string | undefined, period: MetricPeriod): boolean {
  if (period === "tudo") return true;
  if (!iso) return false;
  const days = period === "semana" ? 7 : 30;
  return new Date(iso).getTime() >= Date.now() - days * 86_400_000;
}

function RankTable({ title, rows, max, suffix, tone }: { title: string; rows: { id: string; v: number; n?: number }[]; max?: number; suffix?: string; tone: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">Sem dados no período.</p>
      ) : (
        <div className="space-y-1.5">
          {rows.slice(0, 8).map((r) => (
            <div key={r.id} className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 truncate text-ink">{memberName(r.id)}</span>
              {max != null && (
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
                  <span className={cn("block h-full rounded-full", tone)} style={{ width: `${Math.round((r.v / max) * 100)}%` }} />
                </span>
              )}
              <span className="w-12 shrink-0 text-right font-semibold text-ink">{r.v}{suffix ?? ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DeliveryMetricsModal({ tasks, onClose }: { tasks: DeliveryTask[]; onClose: () => void }) {
  const [period, setPeriod] = useState<MetricPeriod>("mes");

  const m = useMemo(() => {
    const active = tasks.filter((t) => t.stage !== TERMINAL_STAGE);
    const done = tasks.filter((t) => t.stage === TERMINAL_STAGE && inPeriod(t.completedAt, period));
    const overdue = active.filter(isOverdueTask);

    const wip = new Map<string, number>();
    const over = new Map<string, number>();
    const doneCount = new Map<string, number>();
    const lead = new Map<string, { sum: number; n: number }>();
    for (const t of active) for (const id of respIdsOf(t)) wip.set(id, (wip.get(id) ?? 0) + 1);
    for (const t of overdue) for (const id of respIdsOf(t)) over.set(id, (over.get(id) ?? 0) + 1);
    for (const t of done) {
      const c = t.createdAt ? new Date(t.createdAt).getTime() : NaN;
      const f = t.completedAt ? new Date(t.completedAt).getTime() : NaN;
      const leadDays = !isNaN(c) && !isNaN(f) && f >= c ? (f - c) / 86_400_000 : null;
      for (const id of respIdsOf(t)) {
        doneCount.set(id, (doneCount.get(id) ?? 0) + 1);
        if (leadDays != null) {
          const cur = lead.get(id) ?? { sum: 0, n: 0 };
          cur.sum += leadDays;
          cur.n += 1;
          lead.set(id, cur);
        }
      }
    }
    const rank = (map: Map<string, number>) =>
      [...map.entries()].map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
    const fastest = [...lead.entries()]
      .map(([id, d]) => ({ id, v: Math.round((d.sum / d.n) * 10) / 10, n: d.n }))
      .sort((a, b) => a.v - b.v);
    return {
      kpis: {
        ativas: active.length,
        andamento: active.filter((t) => t.stage !== "todo").length,
        concluidas: done.length,
        atrasadas: overdue.length,
      },
      topDoers: rank(doneCount),
      byLoad: rank(wip),
      byOverdue: rank(over),
      fastest,
    };
  }, [tasks, period]);

  const maxDone = Math.max(1, ...m.topDoers.map((r) => r.v));
  const maxLoad = Math.max(1, ...m.byLoad.map((r) => r.v));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink"><BarChart3 className="h-4 w-4 text-brand-500" /> Produtividade do time</h3>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
              {(["semana", "mes", "tudo"] as MetricPeriod[]).map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={cn("rounded-md px-2.5 py-1 font-medium", period === p ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>
                  {p === "semana" ? "7 dias" : p === "mes" ? "30 dias" : "Tudo"}
                </button>
              ))}
            </div>
            <button onClick={onClose} title="Fechar" aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Ativas", value: m.kpis.ativas, tone: "text-ink" },
            { label: "Em andamento", value: m.kpis.andamento, tone: "text-sky-600" },
            { label: "Concluídas", value: m.kpis.concluidas, tone: "text-emerald-600" },
            { label: "Atrasadas", value: m.kpis.atrasadas, tone: "text-rose-600" },
          ].map((k) => (
            <div key={k.label} className="rounded-xl border border-line bg-canvas p-3">
              <p className={cn("text-xl font-bold", k.tone)}>{k.value}</p>
              <p className="text-[11px] text-muted">{k.label}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <RankTable title="Quem concluiu mais" rows={m.topDoers} max={maxDone} tone="bg-emerald-500" />
          <RankTable title="Carga atual (WIP)" rows={m.byLoad} max={maxLoad} tone="bg-brand-500" />
          <RankTable title="Lead time médio (dias)" rows={m.fastest} suffix="d" tone="bg-sky-500" />
          <RankTable title="Atrasadas por pessoa" rows={m.byOverdue} tone="bg-rose-500" />
        </div>
        <p className="mt-3 text-[11px] text-muted">Concluídas = tarefas que entraram na etapa final no período. Lead time = da criação à conclusão. Um card com vários responsáveis conta para cada um.</p>
      </div>
    </div>
  );
}

function sameDay(a: string, b: string) {
  const x = new Date(a), y = new Date(b);
  return x.getUTCFullYear() === y.getUTCFullYear() && x.getUTCMonth() === y.getUTCMonth() && x.getUTCDate() === y.getUTCDate();
}
function capTone(count: number, cap: number): "ok" | "warn" | "over" {
  if (count <= cap) return "ok";
  if (count === cap + 1) return "warn";
  return "over";
}

function Avatar({ id }: { id: string }) {
  return (
    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-[10px] font-bold text-white">
      {memberInitials(id)}
    </span>
  );
}

export function DeliveryPanel({
  tasks: initial,
  meName,
  clients = [],
  team = [],
  config: initialConfig = DELIVERY_CONFIG_FALLBACK,
}: {
  tasks: DeliveryTask[];
  meName?: string;
  clients?: { id: string; name: string }[];
  team?: string[];
  config?: DeliveryConfig;
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [config, setConfig] = useState<DeliveryConfig>(initialConfig);
  const [showConfig, setShowConfig] = useState(false);
  // Re-sincroniza com o servidor quando a lista muda (após criar/refresh).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-seed da lista vinda do servidor
    setItems(initial);
  }, [initial]);
  const [showNew, setShowNew] = useState(false);
  const [showFields, setShowFields] = useState(false);
  const [view, setView] = useState<View>("geral");
  const [mode, setMode] = useState<"meu" | "time">("time");
  const [assignee, setAssignee] = useState<string | null>(null);
  const [origin, setOrigin] = useState<TaskOrigin | null>(null);
  const [client, setClient] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [stageF, setStageF] = useState<TaskStage | null>(null);
  const [priorityF, setPriorityF] = useState<DeliveryPriority | null>(null);
  const [stuckOnly, setStuckOnly] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);
  const [selected, setSelected] = useState<DeliveryTask | null>(null);

  // Deep-link: hidrata os filtros da URL ao montar (compartilhável).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    /* eslint-disable react-hooks/set-state-in-effect */
    if (p.get("q")) setSearch(p.get("q")!);
    if (p.get("stage")) setStageF(p.get("stage") as TaskStage);
    if (p.get("prio")) setPriorityF(p.get("prio") as DeliveryPriority);
    if (p.get("stuck") === "1") setStuckOnly(true);
    if (p.get("resp")) setAssignee(p.get("resp"));
    if (p.get("client")) setClient(p.get("client"));
    if (p.get("origin")) setOrigin(p.get("origin") as TaskOrigin);
    if (p.get("me") === "1") setMode("meu");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  // Espelha os filtros → URL (replaceState, preserva ?task= e não re-renderiza).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const put = (k: string, v: string) => (v ? p.set(k, v) : p.delete(k));
    put("q", search.trim());
    put("stage", stageF ?? "");
    put("prio", priorityF ?? "");
    put("stuck", stuckOnly ? "1" : "");
    put("resp", assignee ?? "");
    put("client", client ?? "");
    put("origin", origin ?? "");
    put("me", mode === "meu" ? "1" : "");
    const qs = p.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  }, [search, stageF, priorityF, stuckOnly, assignee, client, origin, mode]);
  // Deep-link: abre a task de ?task=<id> ao montar (o "Copiar link" da ficha).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = new URLSearchParams(window.location.search).get("task");
    if (!id) return;
    const t = initial.find((x) => x.id === id);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- abre a task do deep-link uma vez
    if (t) setSelected(t);
  }, [initial]);
  const [drill, setDrill] = useState<{ title: string; list: DeliveryTask[] } | null>(null);

  const meId = useMemo(() => {
    if (!meName) return null;
    const m = OPS_TEAM.find((x) => meName.toLowerCase().includes(x.name.split(" ")[0].toLowerCase()));
    return m?.id ?? null;
  }, [meName]);

  const allClients = useMemo(
    () => [...new Set(items.map((t) => t.client))].sort(),
    [items],
  );
  const clientColor = (c: string) => CLIENT_PALETTE[allClients.indexOf(c) % CLIENT_PALETTE.length];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter(
      (t) =>
        (mode === "time" || !meId || respIdsOf(t).includes(meId)) &&
        (!assignee || respIdsOf(t).includes(assignee)) &&
        (!origin || t.origin === origin) &&
        (!client || t.client === client) &&
        (!stageF || t.stage === stageF) &&
        (!priorityF || (t.priority ?? "media") === priorityF) &&
        (!stuckOnly || isStuckTask(t)) &&
        (!term || t.title.toLowerCase().includes(term) || t.client.toLowerCase().includes(term)),
    );
  }, [items, mode, meId, assignee, origin, client, stageF, priorityF, stuckOnly, search]);

  const activeFilters =
    (assignee ? 1 : 0) + (origin ? 1 : 0) + (client ? 1 : 0) + (stageF ? 1 : 0) + (priorityF ? 1 : 0) + (stuckOnly ? 1 : 0) + (search.trim() ? 1 : 0);
  function clearFilters() {
    setSearch(""); setStageF(null); setPriorityF(null); setStuckOnly(false); setAssignee(null); setClient(null); setOrigin(null);
  }

  function setStage(id: string, stage: TaskStage) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, stage } : t)));
    setSelected((s) => (s && s.id === id ? { ...s, stage } : s));
    void postDelivery({ action: "set-stage", id, stage });
  }

  const shared = { openTask: setSelected, clientColor };

  return (
    <div className="space-y-4">
      {/* Toggle de visões */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                view === v.key ? "bg-subtle text-ink" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" /> {v.label}
            </button>
          );
        })}
      </div>

      {/* Meu/Time + filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {(["meu", "time"] as const).map((mo) => (
            <button
              key={mo}
              onClick={() => setMode(mo)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                mode === mo ? "bg-brand-600 text-white" : "text-muted hover:text-ink",
              )}
            >
              {mo === "meu" ? "Meu" : "Time"}
            </button>
          ))}
        </div>
        <select
          value={assignee ?? ""}
          onChange={(e) => setAssignee(e.target.value || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Todos responsáveis</option>
          {OPS_TEAM.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
        <select
          value={client ?? ""}
          onChange={(e) => setClient(e.target.value || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Todos clientes</option>
          {allClients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={origin ?? ""}
          onChange={(e) => setOrigin((e.target.value as TaskOrigin) || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Todas origens</option>
          {ORIGINS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select
          value={stageF ?? ""}
          onChange={(e) => setStageF((e.target.value as TaskStage) || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Todas etapas</option>
          {TASK_STAGES.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <select
          value={priorityF ?? ""}
          onChange={(e) => setPriorityF((e.target.value as DeliveryPriority) || null)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
        >
          <option value="">Toda prioridade</option>
          {DELIVERY_PRIORITIES.map((p) => (
            <option key={p.key} value={p.key}>{p.label}</option>
          ))}
        </select>
        <button
          onClick={() => setStuckOnly((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
            stuckOnly ? "border-rose-400 bg-rose-50 text-rose-600" : "border-line text-muted hover:text-ink",
          )}
        >
          <Pause className="h-3.5 w-3.5" /> Paradas
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tarefa ou cliente…"
            className="w-40 rounded-lg border border-line bg-surface py-1.5 pl-7 pr-2 text-xs text-ink outline-none focus:border-brand-400 sm:w-52"
          />
        </div>
        {activeFilters > 0 && (
          <button onClick={clearFilters} className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink">
            <X className="h-3.5 w-3.5" /> limpar ({activeFilters})
          </button>
        )}
        {mode === "meu" && !meId && (
          <span className="text-xs text-amber-600">Seu usuário não está no time de produção.</span>
        )}
        <button
          onClick={() => setShowMetrics(true)}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
        >
          <BarChart3 className="h-3.5 w-3.5" /> Métricas
        </button>
        <button
          onClick={() => setShowConfig(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" /> Capacidade
        </button>
        <button
          onClick={() => setShowFields(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
        >
          <Settings2 className="h-3.5 w-3.5" /> Campos
        </button>
        <button
          onClick={() => setShowNew((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>
      {showFields && <DeliveryFieldsManager onClose={() => setShowFields(false)} />}
      {showConfig && (
        <DeliveryConfigModal
          config={config}
          onClose={() => setShowConfig(false)}
          onChange={setConfig}
        />
      )}

      {showMetrics && <DeliveryMetricsModal tasks={items} onClose={() => setShowMetrics(false)} />}

      {showNew && (
        <NewDeliveryTask
          clients={clients}
          team={team}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {view === "geral" && <Geral tasks={filtered} onDrill={setDrill} cap={config.capacityPerDay} {...shared} />}
      {view === "kanban" && <Kanban tasks={filtered} onStage={setStage} {...shared} />}
      {view === "calendario" && <Calendario tasks={filtered} {...shared} />}
      {view === "timeline" && <Timeline tasks={filtered} durations={config.typeDurations} {...shared} />}
      {view === "workload" && <Workload tasks={filtered} onDrill={setDrill} cap={config.capacityPerDay} />}
      {view === "cliente" && <PorCliente tasks={filtered} {...shared} />}

      {selected && (
        <TaskFicha
          task={selected}
          clientId={clients.find((c) => c.name === selected.client)?.id ?? ""}
          onClose={() => setSelected(null)}
          onStage={setStage}
        />
      )}
      {drill && (
        <DrillModal
          title={drill.title}
          list={drill.list}
          onClose={() => setDrill(null)}
          onOpen={(t) => {
            setDrill(null);
            setSelected(t);
          }}
        />
      )}
    </div>
  );
}

const DELIVERY_TYPES: TaskType[] = ["Arte", "Vídeo", "Copy", "Tráfego"];
const NEW_DELIVERY = {
  title: "",
  clientId: "",
  assignee: "",
  type: "Arte" as TaskType,
  origin: "Linha editorial" as TaskOrigin,
  dueDate: "",
  estimateH: "",
  urgent: false,
};

function NewDeliveryTask({
  clients,
  team,
  onClose,
  onCreated,
}: {
  clients: { id: string; name: string }[];
  team: string[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [f, setF] = useState(NEW_DELIVERY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const valid = f.title.trim().length > 0;
  const inputCls =
    "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
  const lbl = "mb-0.5 block text-[11px] font-medium text-muted";

  async function save() {
    if (!valid || busy) return;
    setBusy(true);
    setErr(null);
    const est = Number(f.estimateH.replace(",", "."));
    const ok = await postDelivery({
      action: "create",
      title: f.title.trim(),
      clientId: f.clientId || undefined,
      assignee: f.assignee.trim() || undefined,
      type: f.type,
      origin: f.origin,
      dueDate: f.dueDate || undefined,
      estimateH: Number.isFinite(est) ? est : 0,
      urgent: f.urgent,
    });
    setBusy(false);
    if (ok) onCreated();
    else setErr("Não foi possível salvar. Tente novamente.");
  }

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Nova tarefa de entrega</p>
        <button onClick={onClose} title="Fechar" aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className={lbl}>Título *</span>
          <input
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
            placeholder="Ex.: Arte carrossel — campanha julho"
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={lbl}>Cliente</span>
          <select
            value={f.clientId}
            onChange={(e) => setF({ ...f, clientId: e.target.value })}
            className={inputCls}
          >
            <option value="">—</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={lbl}>Responsável</span>
          <input
            list="delivery-team"
            value={f.assignee}
            onChange={(e) => setF({ ...f, assignee: e.target.value })}
            placeholder="Nome"
            className={inputCls}
          />
          <datalist id="delivery-team">
            {team.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </label>
        <label className="block">
          <span className={lbl}>Tipo</span>
          <select
            value={f.type}
            onChange={(e) => setF({ ...f, type: e.target.value as TaskType })}
            className={inputCls}
          >
            {DELIVERY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={lbl}>Origem</span>
          <select
            value={f.origin}
            onChange={(e) => setF({ ...f, origin: e.target.value as TaskOrigin })}
            className={inputCls}
          >
            {ORIGINS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className={lbl}>Prazo</span>
          <input
            type="date"
            value={f.dueDate}
            onChange={(e) => setF({ ...f, dueDate: e.target.value })}
            className={inputCls}
          />
        </label>
        <label className="block">
          <span className={lbl}>Estimativa (h)</span>
          <input
            value={f.estimateH}
            onChange={(e) => setF({ ...f, estimateH: e.target.value })}
            inputMode="decimal"
            placeholder="0"
            className={inputCls}
          />
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink sm:col-span-2">
          <input
            type="checkbox"
            checked={f.urgent}
            onChange={(e) => setF({ ...f, urgent: e.target.checked })}
            className="h-4 w-4 rounded border-line"
          />
          Urgente
        </label>
      </div>
      {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={!valid || busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Criar
        </button>
      </div>
    </div>
  );
}

type Shared = { openTask: (t: DeliveryTask) => void; clientColor: (c: string) => string };

function taskCardBorder(t: DeliveryTask, staleDays: number): string {
  if (t.stage !== "done" && staleDays >= 5) return "border-l-rose-500";
  if (t.stage === "done") return "border-l-emerald-500";
  if (t.priority === "urgente") return "border-l-rose-400";
  if (t.priority === "alta") return "border-l-amber-400";
  return "border-l-brand-400";
}

function TaskCard({ t, openTask, clientColor, draggable, onDragStart }: {
  t: DeliveryTask;
  openTask: (t: DeliveryTask) => void;
  clientColor: (c: string) => string;
  draggable?: boolean;
  onDragStart?: () => void;
}) {
  const [staleDays, setStaleDays] = useState(0);
  useEffect(() => {
    const ref = t.movedAt ? Date.parse(t.movedAt) : NaN;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- calcula "dias parada" só no cliente (evita Date.now no render)
    if (!Number.isNaN(ref)) setStaleDays(Math.floor((Date.now() - ref) / 86_400_000));
  }, [t.movedAt]);

  const names = (t.assignees?.length ? t.assignees : [t.assignee]).filter(Boolean).map(memberName);
  const prio = DELIVERY_PRIORITIES.find((x) => x.key === (t.priority ?? "media"));

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={() => openTask(t)}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-l-4 border-line bg-surface p-3 shadow-sm transition-shadow hover:shadow-md",
        taskCardBorder(t, staleDays),
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{t.title}</p>
        {names.length > 0 && <AvatarStack names={names} />}
      </div>
      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: clientColor(t.client) }} />
        {t.client}
      </p>
      {t.requester && <p className="mt-0.5 text-[11px] text-muted">Pedido por {t.requester}</p>}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {prio && (
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", prio.chip)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", prio.dot)} /> {prio.label}
          </span>
        )}
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", TYPE_COLOR.get(t.type) ?? "bg-subtle text-muted")}>{t.type}</span>
        {t.stage !== "done" && staleDays >= 5 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-500">
            <Pause className="h-2.5 w-2.5" /> parada {staleDays}d
          </span>
        )}
      </div>

      <p className={cn("mt-2 text-[11px]", t.late ? "font-semibold text-rose-500" : "text-muted")}>{t.dueLabel}</p>
    </div>
  );
}

// --- Visão geral (ENT01-04) --------------------------------------------------
function Stat({ label, value, tone, onClick }: { label: string; value: number; tone?: string; onClick?: () => void }) {
  return (
    <Card className={cn("p-4", onClick && value > 0 && "cursor-pointer transition-shadow hover:shadow-md")}>
      <button className="w-full text-left" onClick={onClick} disabled={!onClick || value === 0}>
        <p className="text-xs text-muted">{label}</p>
        <p className={cn("mt-1 text-2xl font-bold", tone ?? "text-ink")}>{value}</p>
        {onClick && value > 0 && <p className="text-[10px] text-brand-500">ver quem</p>}
      </button>
    </Card>
  );
}

function Geral({ tasks, onDrill, cap }: {
  tasks: DeliveryTask[];
  onDrill: (d: { title: string; list: DeliveryTask[] }) => void;
  cap: number;
} & Shared) {
  const open = tasks.filter((t) => t.stage !== "done");
  const doing = tasks.filter((t) => t.stage === "doing").length;
  const approval = tasks.filter((t) => t.stage === "approval").length;
  const lateList = tasks.filter((t) => t.late);
  const isActionable = (t: DeliveryTask) => ["todo", "doing", "review"].includes(t.stage);
  const today = tasks.filter((t) => isActionable(t) && sameDay(t.dueDate, DELIVERY_TODAY_ISO) && !t.late);
  const week = tasks.filter((t) => isActionable(t) && !t.late);
  const maxStage = Math.max(1, ...TASK_STAGES.map((s) => tasks.filter((t) => t.stage === s.key).length));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Stat label="Tarefas abertas" value={open.length} />
        <Stat label="Em andamento" value={doing} tone="text-sky-500" />
        <Stat label="Aguardando cliente" value={approval} tone="text-amber-500" />
        <Stat
          label="Atrasadas"
          value={lateList.length}
          tone={lateList.length > 0 ? "text-rose-500" : "text-ink"}
          onClick={() => onDrill({ title: "Tarefas atrasadas", list: lateList })}
        />
        <Stat label="Vence hoje" value={today.length} tone="text-brand-600" onClick={() => onDrill({ title: "Vence hoje", list: today })} />
        <Stat label="Vence esta semana" value={week.length} onClick={() => onDrill({ title: "Vence esta semana", list: week })} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Por estágio</h3>
          <div className="space-y-2.5">
            {TASK_STAGES.map((s) => {
              const n = tasks.filter((t) => t.stage === s.key).length;
              return (
                <div key={s.key} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-sm text-muted">{s.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${(n / maxStage) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right text-sm font-medium text-ink">{n}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="mb-1 text-sm font-semibold text-ink">Carga da equipe</h3>
          <p className="mb-3 text-xs text-muted">Em nº de tasks. Alerta pela capacidade ({cap}/dia).</p>
          <div className="space-y-2.5">
            {OPS_TEAM.map((m) => {
              const mine = tasks.filter((t) => t.assignee === m.id && t.stage !== "done");
              const peak = Math.max(0, ...WEEKDAYS.map((_, d) => mine.filter((t) => t.day === d).length));
              const tone = capTone(peak, cap);
              const maxCount = Math.max(1, ...OPS_TEAM.map((mm) => tasks.filter((t) => t.assignee === mm.id && t.stage !== "done").length));
              return (
                <button
                  key={m.id}
                  onClick={() => mine.length && onDrill({ title: `Tarefas de ${m.name}`, list: mine })}
                  className="flex w-full items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-subtle"
                >
                  <span className="w-24 shrink-0 text-sm text-muted">{m.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle-strong">
                    <div
                      className={cn("h-full rounded-full", tone === "over" ? "bg-rose-500" : tone === "warn" ? "bg-amber-500" : "bg-emerald-500")}
                      style={{ width: `${(mine.length / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-muted">{mine.length} tasks</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
      <p className="text-xs text-muted">Dica: clique em <strong className="text-ink">Atrasadas</strong>, <strong className="text-ink">Vence hoje</strong> ou numa barra de carga para ver as tarefas.</p>
    </div>
  );
}

// --- Kanban (ENT05-07) -------------------------------------------------------
function Kanban({ tasks, onStage, openTask, clientColor }: {
  tasks: DeliveryTask[];
  onStage: (id: string, s: TaskStage) => void;
} & Shared) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<TaskStage | null>(null);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {TASK_STAGES.map((s) => {
        const col = tasks.filter((t) => t.stage === s.key);
        return (
          <div
            key={s.key}
            onDragOver={(e) => { e.preventDefault(); setOver(s.key); }}
            onDragLeave={() => setOver((c) => (c === s.key ? null : c))}
            onDrop={() => { if (dragId) onStage(dragId, s.key); setDragId(null); setOver(null); }}
            className={cn("rounded-2xl p-2.5 transition-colors", over === s.key ? "bg-brand-50" : "bg-subtle")}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-sm font-semibold text-ink">{s.label}</span>
              <span className="rounded-full bg-surface px-1.5 py-0.5 text-xs font-medium text-muted">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((t) => (
                <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} draggable onDragStart={() => setDragId(t.id)} />
              ))}
              {col.length === 0 && <p className="px-1 py-4 text-center text-xs text-muted">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Calendário (ENT08-09) — por data de entrega, cor por cliente ------------
function Calendario({ tasks, openTask, clientColor }: { tasks: DeliveryTask[] } & Shared) {
  const [sub, setSub] = useState<"dia" | "semana" | "mes">("semana");
  const [dayIdx, setDayIdx] = useState(DELIVERY_TODAY_IDX);

  const SubToggle = (
    <div className="mb-3 inline-flex rounded-lg border border-line bg-surface p-0.5">
      {(["dia", "semana", "mes"] as const).map((s) => (
        <button key={s} onClick={() => setSub(s)}
          className={cn("rounded-md px-3 py-1 text-xs font-medium", sub === s ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>
          {s === "dia" ? "Dia" : s === "semana" ? "Semana" : "Mês"}
        </button>
      ))}
    </div>
  );

  if (sub === "dia") {
    const day = tasks.filter((t) => t.day === dayIdx);
    return (
      <div>
        {SubToggle}
        <div className="mb-3 flex gap-1">
          {WEEKDAYS.map((wd, i) => (
            <button key={wd} onClick={() => setDayIdx(i)}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", dayIdx === i ? "bg-brand-600 text-white" : "bg-surface text-muted hover:text-ink")}>
              {wd}{i === DELIVERY_TODAY_IDX ? " (hoje)" : ""}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {day.map((t) => <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} />)}
          {day.length === 0 && <Card className="p-8 text-center text-sm text-muted">Sem entregas neste dia.</Card>}
        </div>
      </div>
    );
  }

  if (sub === "semana") {
    return (
      <div>
        {SubToggle}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {WEEKDAYS.map((wd, i) => {
            const day = tasks.filter((t) => t.day === i);
            return (
              <div key={wd} className={cn("rounded-2xl border p-2.5", i === DELIVERY_TODAY_IDX ? "border-brand-400 bg-brand-50/40" : "border-line bg-surface")}>
                <p className="mb-2 px-1 text-sm font-semibold text-ink">{wd}{i === DELIVERY_TODAY_IDX ? " · hoje" : ""}</p>
                <div className="space-y-2">
                  {day.map((t) => <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} />)}
                  {day.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mês — grade do mês de "hoje", tasks na data real de entrega
  const today = new Date(DELIVERY_TODAY_ISO);
  const y = today.getUTCFullYear(), mo = today.getUTCMonth();
  const first = new Date(Date.UTC(y, mo, 1));
  const startDow = first.getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const tasksOn = (d: number) => tasks.filter((t) => { const dd = new Date(t.dueDate); return dd.getUTCFullYear() === y && dd.getUTCMonth() === mo && dd.getUTCDate() === d; });

  return (
    <div>
      {SubToggle}
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">
          {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d) => <span key={d}>{d}</span>)}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const list = d ? tasksOn(d) : [];
            const isToday = d === today.getUTCDate();
            return (
              <div key={i} className={cn("min-h-[72px] rounded-lg border p-1", isToday ? "border-brand-400 bg-brand-50/40" : "border-line")}>
                {d && <p className="px-1 text-[10px] font-medium text-muted">{d}</p>}
                <div className="space-y-0.5">
                  {list.slice(0, 3).map((t) => (
                    <button key={t.id} onClick={() => openTask(t)}
                      className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white"
                      style={{ backgroundColor: clientColor(t.client) }}>
                      {t.title}
                    </button>
                  ))}
                  {list.length > 3 && <p className="px-1 text-[9px] text-muted">+{list.length - 3}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

// --- Linha do tempo (ENT10-11) — agenda por membro, blocos por duração -------
function Timeline({ tasks, openTask, clientColor, durations }: { tasks: DeliveryTask[]; durations: Record<string, number> } & Shared) {
  const [dayIdx, setDayIdx] = useState(DELIVERY_TODAY_IDX);
  const START = 9, END = 19; // 9h–19h
  const totalMin = (END - START) * 60;
  const members = OPS_TEAM.filter((m) => tasks.some((t) => t.assignee === m.id));

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {WEEKDAYS.map((wd, i) => (
          <button key={wd} onClick={() => setDayIdx(i)}
            className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", dayIdx === i ? "bg-brand-600 text-white" : "bg-surface text-muted hover:text-ink")}>
            {wd}{i === DELIVERY_TODAY_IDX ? " (hoje)" : ""}
          </button>
        ))}
      </div>
      <Card className="overflow-x-auto p-4">
        <div className="min-w-[720px]">
          {/* Régua de horas */}
          <div className="mb-1 grid gap-0" style={{ gridTemplateColumns: `120px 1fr` }}>
            <span />
            <div className="flex justify-between text-[10px] text-muted">
              {Array.from({ length: END - START + 1 }, (_, h) => <span key={h}>{START + h}h</span>)}
            </div>
          </div>
          <div className="space-y-2">
            {members.map((m) => {
              const dayTasks = tasks.filter((t) => t.assignee === m.id && t.day === dayIdx);
              let cursor = 0; // minutos desde START
              return (
                <div key={m.id} className="grid items-center gap-0" style={{ gridTemplateColumns: `120px 1fr` }}>
                  <div className="flex items-center gap-2 pr-2">
                    <Avatar id={m.id} />
                    <span className="truncate text-xs font-medium text-ink">{m.name}</span>
                  </div>
                  <div className="relative h-9 rounded-lg bg-subtle">
                    {dayTasks.map((t) => {
                      const dur = t.durationMin ?? durations[t.type] ?? 60;
                      const left = (cursor / totalMin) * 100;
                      const width = Math.min(100 - left, (dur / totalMin) * 100);
                      cursor += dur;
                      if (left >= 100) return null;
                      return (
                        <button key={t.id} onClick={() => openTask(t)}
                          title={`${t.title} · ${dur}min`}
                          className="absolute top-0 flex h-9 items-center overflow-hidden rounded-md px-2 text-[10px] font-medium text-white"
                          style={{ left: `${left}%`, width: `${Math.max(4, width)}%`, backgroundColor: clientColor(t.client) }}>
                          <span className="truncate">{t.title}</span>
                        </button>
                      );
                    })}
                    {dayTasks.length === 0 && <span className="absolute inset-0 flex items-center justify-center text-[10px] text-muted">livre</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] text-muted">Blocos sequenciais a partir das {START}h, tamanho pela duração padrão do tipo de task. Cor por cliente.</p>
        </div>
      </Card>
    </div>
  );
}

// --- Workload (ENT12-13) — nº de tasks, capacidade compartilhada -------------
function Workload({ tasks, onDrill, cap }: { tasks: DeliveryTask[]; onDrill: (d: { title: string; list: DeliveryTask[] }) => void; cap: number }) {
  return (
    <Card className="overflow-x-auto p-4">
      <div className="min-w-[640px]">
        <div className="mb-2 grid grid-cols-[160px_repeat(5,1fr)] gap-1 text-center text-xs font-medium text-muted">
          <span />
          {WEEKDAYS.map((wd) => <span key={wd}>{wd}</span>)}
        </div>
        <div className="space-y-1.5">
          {OPS_TEAM.map((m) => (
            <div key={m.id} className="grid grid-cols-[160px_repeat(5,1fr)] items-center gap-1">
              <div className="flex items-center gap-2 pr-2">
                <Avatar id={m.id} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{m.name}</p>
                  <p className="text-[10px] text-muted">{m.role}</p>
                </div>
              </div>
              {WEEKDAYS.map((_, d) => {
                const list = tasks.filter((t) => t.assignee === m.id && t.day === d && t.stage !== "done");
                const n = list.length;
                const tone = n === 0 ? "bg-subtle text-muted" : capTone(n, cap) === "over" ? "bg-rose-500/25 text-rose-500" : capTone(n, cap) === "warn" ? "bg-amber-500/25 text-amber-600" : "bg-emerald-500/20 text-emerald-600";
                return (
                  <button key={d} onClick={() => n && onDrill({ title: `${m.name} · ${WEEKDAYS[d]}`, list })}
                    className={cn("flex h-9 items-center justify-center rounded-md text-xs font-semibold", tone)}>
                    {n > 0 ? n : "—"}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Capacidade: {cap} tasks/dia por pessoa. Verde ≤{cap}, âmbar {cap + 1}, vermelho {cap + 2}+. Clique numa célula para ver as tarefas.</p>
      </div>
    </Card>
  );
}

// --- Entregas por cliente (ENT14-15) — kanban por cliente + janela -----------
function PorCliente({ tasks, openTask, clientColor }: { tasks: DeliveryTask[] } & Shared) {
  const [win, setWin] = useState<"dia" | "semana" | "mes">("semana");
  const today = new Date(DELIVERY_TODAY_ISO);
  const inWin = (t: DeliveryTask) => {
    const d = new Date(t.dueDate);
    if (win === "dia") return sameDay(t.dueDate, DELIVERY_TODAY_ISO);
    if (win === "mes") return d.getUTCFullYear() === today.getUTCFullYear() && d.getUTCMonth() === today.getUTCMonth();
    return true; // semana (mock: todas na semana atual)
  };
  const list = tasks.filter(inWin);
  const clients = [...new Set(list.map((t) => t.client))].sort();

  return (
    <div>
      <div className="mb-3 inline-flex rounded-lg border border-line bg-surface p-0.5">
        {(["dia", "semana", "mes"] as const).map((w) => (
          <button key={w} onClick={() => setWin(w)}
            className={cn("rounded-md px-3 py-1 text-xs font-medium", win === w ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>
            {w === "dia" ? "Hoje" : w === "semana" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>
      {clients.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted">Sem entregas nesta janela.</Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {clients.map((c) => {
            const col = list.filter((t) => t.client === c);
            return (
              <div key={c} className="w-[240px] shrink-0 rounded-2xl border border-line bg-canvas p-2.5">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: clientColor(c) }} />
                  <span className="flex-1 truncate text-sm font-semibold text-ink">{c}</span>
                  <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((t) => <TaskCard key={t.id} t={t} openTask={openTask} clientColor={clientColor} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DrillModal({ title, list, onClose, onOpen }: {
  title: string;
  list: DeliveryTask[];
  onClose: () => void;
  onOpen: (t: DeliveryTask) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line p-4">
          <h2 className="text-sm font-semibold text-ink">{title} · {list.length}</h2>
          <button onClick={onClose} title="Fechar" aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
        </div>
        <div className="divide-y divide-line">
          {list.map((t) => (
            <button key={t.id} onClick={() => onOpen(t)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-subtle">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{t.title}</p>
                <p className="text-xs text-muted">{t.client} · {memberName(t.assignee)}</p>
              </div>
              <span className={cn("shrink-0 text-[11px] font-medium", t.late ? "text-rose-500" : "text-muted")}>{t.dueLabel}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
