"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Flag,
  List as ListIcon,
  ListChecks,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  RefreshCw,
  Save,
  SkipForward,
  SquareCheck,
  Target,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { withToast } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { dayMonth, clockLabel } from "@/lib/datetime";
import {
  DEAL_SCRIPTS,
  LEAD_PRIORITIES,
  TASK_TYPES,
  stageLabel,
  suggestedScriptFor,
  type DealScript,
  type Pipeline,
  type TaskItem,
} from "@/lib/data/crm";
import { formatPhone } from "@/lib/data/inbox";
import { BulkTaskModal } from "./bulk-task-modal";

/* ── Metadados de tipo ─────────────────────────────────── */

const TYPE_META: Record<string, { label: string; icon: typeof Phone; dot: string; chip: string }> = {
  ligacao: { label: "Ligação", icon: Phone, dot: "bg-sky-500", chip: "bg-sky-500/15 text-sky-600" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, dot: "bg-emerald-500", chip: "bg-emerald-500/15 text-emerald-600" },
  email: { label: "E-mail", icon: Mail, dot: "bg-violet-500", chip: "bg-violet-500/15 text-violet-600" },
  reuniao: { label: "Reunião", icon: Users, dot: "bg-amber-500", chip: "bg-amber-500/15 text-amber-600" },
  prazo: { label: "Prazo", icon: Flag, dot: "bg-rose-500", chip: "bg-rose-500/15 text-rose-600" },
  todo: { label: "To-do", icon: SquareCheck, dot: "bg-slate-400", chip: "bg-subtle text-muted" },
};
const typeOf = (t: TaskItem) => String(t.properties?.type ?? "todo");
const durationOf = (t: TaskItem) => Number(t.properties?.duration_min ?? 0);

/* ── Datas ─────────────────────────────────────────────── */

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
const isOverdue = (t: TaskItem, now: Date) => t.status === "pending" && !!t.dueDate && Date.parse(t.dueDate) < now.getTime();

type Temporal = "todas" | "vencido" | "hoje" | "amanha" | "semana" | "proxima" | "concluidas" | "custom";
const TEMPORAL_TABS: { key: Temporal; label: string }[] = [
  { key: "todas", label: "Para fazer" },
  { key: "vencido", label: "Vencido" },
  { key: "hoje", label: "Hoje" },
  { key: "amanha", label: "Amanhã" },
  { key: "semana", label: "Esta semana" },
  { key: "proxima", label: "Próxima semana" },
  { key: "concluidas", label: "Concluídas" },
];

function matchesTemporal(t: TaskItem, temporal: Temporal, now: Date, custom: { from: string; to: string }): boolean {
  if (temporal === "concluidas") return t.status === "done";
  if (t.status !== "pending") return false;
  if (temporal === "todas") return true;
  if (!t.dueDate) return false;
  const due = new Date(t.dueDate);
  const today = startOfDay(now).getTime();
  const dueDay = startOfDay(due).getTime();
  switch (temporal) {
    case "vencido": return Date.parse(t.dueDate) < now.getTime();
    case "hoje": return dueDay === today;
    case "amanha": return dueDay === today + DAY;
    case "semana": return dueDay >= today && dueDay <= today + 6 * DAY;
    case "proxima": return dueDay >= today + 7 * DAY && dueDay <= today + 13 * DAY;
    case "custom": {
      const from = custom.from ? new Date(custom.from).getTime() : -Infinity;
      const to = custom.to ? new Date(custom.to).getTime() + DAY : Infinity;
      return Date.parse(t.dueDate) >= from && Date.parse(t.dueDate) < to;
    }
    default: return true;
  }
}

const priorityRank: Record<string, number> = { urgente: 4, alta: 3, media: 2, baixa: 1 };
function byPriorityThenTime(a: TaskItem, b: TaskItem) {
  const pr = (priorityRank[b.priority ?? "media"] ?? 2) - (priorityRank[a.priority ?? "media"] ?? 2);
  if (pr) return pr;
  return (Date.parse(a.dueDate ?? "") || Infinity) - (Date.parse(b.dueDate ?? "") || Infinity);
}

/* ── localStorage ──────────────────────────────────────── */
function loadPref<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { return (localStorage.getItem(key) as T) || fallback; } catch { return fallback; }
}
function savePref(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

/** Visão salva de tarefas (preset de filtros), estilo HubSpot — por usuário. */
type SavedTaskView = {
  name: string;
  scope: "meu" | "time";
  ownerSel: string;
  temporal: Temporal;
  types: string[];
  priority: string;
  pipeline: string;
};

/* ── API helper ────────────────────────────────────────── */
function postTask(body: unknown) {
  // withToast: falha vira aviso ao usuário (não some sem avisar).
  return withToast(fetch("/api/crm/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }));
}

/* ════════════════════════════════════════════════════════ */

export function CrmActivities({
  tasks,
  deals = [],
  pipelines = [],
  team = [],
  currentUser = "",
  scripts = DEAL_SCRIPTS,
}: {
  tasks: TaskItem[];
  deals?: { id: string; name: string; owner?: string }[];
  pipelines?: Pipeline[];
  team?: string[];
  currentUser?: string;
  scripts?: DealScript[];
}) {
  const router = useRouter();
  const now = new Date();

  const [items, setItems] = useState<TaskItem[]>(tasks);
  const [view, setView] = useState<"lista" | "calendario" | "foco">(() => loadPref("atv-view", "lista"));
  const [temporal, setTemporal] = useState<Temporal>(() => loadPref("atv-temporal", "todas"));
  const [typeSel, setTypeSel] = useState<Set<string>>(new Set());
  const [priority, setPriority] = useState<string>("all");
  const [pipelineSel, setPipelineSel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [foco, setFoco] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [drawer, setDrawer] = useState<{ task?: TaskItem; create?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  // Escopo (HubSpot): minhas x do time + filtro por responsável.
  const [scope, setScope] = useState<"meu" | "time">(() => loadPref("atv-scope", "meu"));
  const [ownerSel, setOwnerSel] = useState<string>("all");
  // Visões salvas (por usuário, localStorage) — abas estilo HubSpot.
  const [views, setViews] = useState<SavedTaskView[]>([]);
  const [activeView, setActiveView] = useState<string | null>(null);

  useEffect(() => savePref("atv-view", view), [view]);
  useEffect(() => savePref("atv-temporal", temporal), [temporal]);
  useEffect(() => savePref("atv-scope", scope), [scope]);
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      const raw = localStorage.getItem("atv-views");
      if (raw) setViews(JSON.parse(raw) as SavedTaskView[]);
    } catch {
      /* ignore */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const isMine = (t: TaskItem) => {
    const a = t.assignees?.length ? t.assignees : t.assignee ? [t.assignee] : [];
    return a.length ? a.includes(currentUser) : t.owner === currentUser;
  };
  const ownersOf = (t: TaskItem) =>
    t.assignees?.length ? t.assignees : t.assignee ? [t.assignee] : t.owner ? [t.owner] : [];
  // Escopo: responsável específico > minhas/do time. isMine depende de currentUser (já nas deps).
  const scoped = useMemo(() => {
    if (ownerSel !== "all") return items.filter((t) => ownersOf(t).includes(ownerSel));
    if (scope === "meu") return items.filter(isMine);
    return items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, ownerSel, scope, currentUser]);

  function persistViews(next: SavedTaskView[]) {
    setViews(next);
    try {
      localStorage.setItem("atv-views", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  function saveCurrentView() {
    const name = window.prompt("Nome da visão salva:");
    if (!name?.trim()) return;
    const v: SavedTaskView = {
      name: name.trim(),
      scope,
      ownerSel,
      temporal,
      types: [...typeSel],
      priority,
      pipeline: pipelineSel,
    };
    persistViews([...views.filter((x) => x.name !== v.name), v]);
    setActiveView(v.name);
  }
  function applyView(v: SavedTaskView) {
    setScope(v.scope);
    setOwnerSel(v.ownerSel);
    setTemporal(v.temporal);
    setTypeSel(new Set(v.types));
    setPriority(v.priority);
    setPipelineSel(v.pipeline);
    setActiveView(v.name);
  }
  function resetView() {
    setOwnerSel("all");
    setScope("meu");
    setTemporal("todas");
    setTypeSel(new Set());
    setPriority("all");
    setPipelineSel("all");
    setActiveView(null);
  }

  // Filtro base (tipo/prioridade/pipeline/busca) — sem o temporal.
  const baseFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return scoped.filter((t) => {
      if (typeSel.size > 0 && !typeSel.has(typeOf(t))) return false;
      if (priority !== "all" && (t.priority ?? "media") !== priority) return false;
      if (pipelineSel !== "all" && (t.pipelineId ?? "") !== pipelineSel) return false;
      if (term) {
        const hay = `${t.title} ${t.dealName} ${t.contactName ?? ""}`.toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [scoped, typeSel, priority, pipelineSel, search]);

  const filtered = useMemo(
    () => baseFiltered.filter((t) => matchesTemporal(t, temporal, now, custom)).sort(byPriorityThenTime),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseFiltered, temporal, custom.from, custom.to],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const tab of TEMPORAL_TABS) c[tab.key] = baseFiltered.filter((t) => matchesTemporal(t, tab.key, now, custom)).length;
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseFiltered]);

  /* ── Ações ── */
  function patchLocal(id: string, patch: Partial<TaskItem>) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  async function conclude(t: TaskItem, note?: string, channel: string = "note") {
    patchLocal(t.id, { status: "done", doneAt: now.toISOString() });
    setSelected((s) => { const n = new Set(s); n.delete(t.id); return n; });
    await postTask({ action: "done", taskId: t.id }).catch(() => {});
    if (note?.trim() && t.leadId) {
      await fetch("/api/crm/interactions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: t.leadId, channel, body: `✔️ ${t.title}\n${note.trim()}` }),
      }).catch(() => {});
    }
    router.refresh();
  }
  async function reopen(t: TaskItem) {
    patchLocal(t.id, { status: "pending", doneAt: undefined });
    await postTask({ action: "reopen", taskId: t.id }).catch(() => {});
    router.refresh();
  }
  async function remark(ids: string[], iso: string) {
    setBusy(true);
    ids.forEach((id) => patchLocal(id, { dueDate: iso }));
    await Promise.all(ids.map((id) => postTask({ action: "update", taskId: id, dueDate: iso }).catch(() => {})));
    setBusy(false); setSelected(new Set()); router.refresh();
  }
  async function reassign(ids: string[], name: string) {
    setBusy(true);
    ids.forEach((id) => patchLocal(id, { assignees: [name], assignee: name }));
    await Promise.all(ids.map((id) => postTask({ action: "set-assignees", taskId: id, assignees: [name] }).catch(() => {})));
    setBusy(false); setSelected(new Set()); router.refresh();
  }
  async function setPrio(ids: string[], p: string) {
    setBusy(true);
    ids.forEach((id) => patchLocal(id, { priority: p as TaskItem["priority"] }));
    await Promise.all(ids.map((id) => postTask({ action: "set-priority", taskId: id, priority: p }).catch(() => {})));
    setBusy(false); setSelected(new Set()); router.refresh();
  }
  async function bulkConclude(ids: string[]) {
    setBusy(true);
    ids.forEach((id) => patchLocal(id, { status: "done" }));
    await Promise.all(ids.map((id) => postTask({ action: "done", taskId: id }).catch(() => {})));
    setBusy(false); setSelected(new Set()); router.refresh();
  }
  async function bulkDelete(ids: string[]) {
    setBusy(true);
    setItems((prev) => prev.filter((t) => !ids.includes(t.id)));
    await Promise.all(ids.map((id) => postTask({ action: "delete", taskId: id }).catch(() => {})));
    setBusy(false); setSelected(new Set()); router.refresh();
  }

  function toggleType(k: string) {
    setTypeSel((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  }
  const toggleSel = (id: string) =>
    setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const overdueCount = scoped.filter((t) => isOverdue(t, now)).length;
  const focoQueue = baseFiltered
    .filter((t) => t.status === "pending" && (isOverdue(t, now) || (t.dueDate && sameDay(new Date(t.dueDate), now)) || !t.dueDate))
    .sort(byPriorityThenTime);

  return (
    <div className="space-y-4">
      {/* Toolbar: view toggle + criar + modo foco */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-xl border border-line p-0.5">
          {([["lista", ListIcon, "Lista"], ["calendario", CalendarDays, "Calendário"], ["foco", Target, "Prioridades"]] as const).map(
            ([k, Icon, label]) => (
              <button
                key={k}
                onClick={() => setView(k)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  view === k ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ),
          )}
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-1 text-xs font-semibold text-rose-600">
              <Clock className="h-3.5 w-3.5" /> {overdueCount} vencida{overdueCount > 1 ? "s" : ""}
            </span>
          )}
          <button
            onClick={() => setFoco(true)}
            disabled={!filtered.some((t) => t.status === "pending")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-50"
            title="Executar as tarefas filtradas uma a uma"
          >
            <Zap className="h-4 w-4" /> Modo foco
          </button>
          <button
            onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle"
          >
            <ListChecks className="h-4 w-4" /> Em massa
          </button>
          <button
            onClick={() => setDrawer({ create: true })}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Atividade
          </button>
        </div>
      </div>

      {/* Visões salvas (abas estilo HubSpot) */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-line">
        <TaskViewTab active={activeView === null} onClick={resetView} label="Todas as tarefas" />
        {views.map((v) => (
          <TaskViewTab
            key={v.name}
            active={activeView === v.name}
            onClick={() => applyView(v)}
            onDelete={() => {
              persistViews(views.filter((x) => x.name !== v.name));
              if (activeView === v.name) setActiveView(null);
            }}
            label={v.name}
          />
        ))}
        <button
          onClick={saveCurrentView}
          className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-subtle"
        >
          <Save className="h-3.5 w-3.5" /> Salvar visão
        </button>
      </div>

      {/* Filtro temporal */}
      <div className="flex flex-wrap items-center gap-1.5">
        {TEMPORAL_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setTemporal(tab.key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              temporal === tab.key
                ? tab.key === "vencido" ? "bg-rose-600 text-white" : "bg-ink text-surface"
                : "bg-subtle text-muted hover:bg-subtle-strong",
            )}
          >
            {tab.label}
            <span className={cn("rounded-full px-1.5 text-[10px]", temporal === tab.key ? "bg-white/25" : "bg-surface")}>
              {counts[tab.key] ?? 0}
            </span>
          </button>
        ))}
        {temporal === "custom" && (
          <span className="inline-flex items-center gap-1">
            <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs" />
            <span className="text-muted">→</span>
            <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs" />
          </span>
        )}
        <button
          onClick={() => setTemporal("custom")}
          className={cn("rounded-full px-2.5 py-1.5 text-xs font-medium", temporal === "custom" ? "bg-ink text-surface" : "text-muted hover:bg-subtle")}
        >
          Período…
        </button>
      </div>

      {/* Filtros: tipo + prioridade + pipeline + busca */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1">
          {TASK_TYPES.map((ty) => {
            const on = typeSel.has(ty.key);
            const meta = TYPE_META[ty.key];
            const Icon = meta.icon;
            return (
              <button
                key={ty.key}
                onClick={() => toggleType(ty.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  on ? meta.chip : "bg-subtle text-muted hover:bg-subtle-strong",
                )}
              >
                <Icon className="h-3 w-3" /> {ty.label}
              </button>
            );
          })}
          {typeSel.size > 0 && (
            <button onClick={() => setTypeSel(new Set())} className="rounded-full px-2 py-1 text-xs text-muted hover:text-ink">limpar</button>
          )}
        </div>
        <div className="inline-flex rounded-lg border border-line bg-surface p-0.5 text-xs">
          {([["meu", "Minhas"], ["time", "Do time"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => { setScope(k); setOwnerSel("all"); }}
              className={cn(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                ownerSel === "all" && scope === k ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        {team.length > 0 && (
          <select value={ownerSel} onChange={(e) => setOwnerSel(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400">
            <option value="all">Todos responsáveis</option>
            {team.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400">
          <option value="all">Toda prioridade</option>
          <option value="alta">Alta</option>
          <option value="media">Normal</option>
          <option value="baixa">Baixa</option>
        </select>
        {pipelines.length > 1 && (
          <select value={pipelineSel} onChange={(e) => setPipelineSel(e.target.value)} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand-400">
            <option value="all">Todos os funis</option>
            {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar lead ou contato…"
          className="ml-auto w-52 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        />
      </div>

      {/* Barra de ações em massa */}
      {selected.size > 0 && view === "lista" && (
        <BulkBar
          count={selected.size}
          team={team}
          busy={busy}
          onConclude={() => bulkConclude([...selected])}
          onRemark={(iso) => remark([...selected], iso)}
          onReassign={(n) => reassign([...selected], n)}
          onPriority={(p) => setPrio([...selected], p)}
          onDelete={() => bulkDelete([...selected])}
          onClear={() => setSelected(new Set())}
        />
      )}

      {/* Views */}
      {view === "lista" && (
        <ListView
          items={filtered}
          now={now}
          selected={selected}
          onToggleSel={toggleSel}
          onToggleAll={() => setSelected(selected.size === filtered.length ? new Set() : new Set(filtered.map((t) => t.id)))}
          onConclude={conclude}
          onReopen={reopen}
          onOpen={(t) => setDrawer({ task: t })}
        />
      )}
      {view === "calendario" && (
        <CalendarView items={baseFiltered.filter((t) => t.status === "pending")} now={now} onOpen={(t) => setDrawer({ task: t })} onCreate={(iso) => setDrawer({ create: true, task: { dueDate: iso } as TaskItem })} />
      )}
      {view === "foco" && (
        <FocusView items={focoQueue} now={now} onConclude={conclude} onOpen={(t) => setDrawer({ task: t })} />
      )}

      {/* Modo foco / cockpit (fila = a lista filtrada atual) */}
      {foco && (
        <FocusCockpit
          queue={filtered.filter((t) => t.status === "pending")}
          scripts={scripts}
          pipelines={pipelines}
          onClose={() => setFoco(false)}
          onConclude={conclude}
          onRemark={(t, iso) => remark([t.id], iso)}
          onOpen={(t) => setDrawer({ task: t })}
        />
      )}

      {/* Criar tarefas em massa (seletor de negócios) */}
      {bulkOpen && (
        <BulkTaskModal
          targetLabel="negócios"
          count={0}
          team={team}
          currentUser={currentUser}
          pickTargets={{ deals: deals.map((d) => ({ id: d.id, name: d.name })) }}
          onClose={() => setBulkOpen(false)}
          onDone={() => { setBulkOpen(false); router.refresh(); }}
        />
      )}

      {/* Drawer criar/editar */}
      {drawer && (
        <TaskDrawer
          task={drawer.task}
          create={drawer.create}
          deals={deals}
          team={team}
          currentUser={currentUser}
          scripts={scripts}
          onClose={() => setDrawer(null)}
          onSaved={() => { setDrawer(null); router.refresh(); }}
          onConclude={(note) => { if (drawer.task?.id) conclude(drawer.task as TaskItem, note); setDrawer(null); }}
        />
      )}
    </div>
  );
}

/* ── Lista ─────────────────────────────────────────────── */

function ListView({
  items, now, selected, onToggleSel, onToggleAll, onConclude, onReopen, onOpen,
}: {
  items: TaskItem[];
  now: Date;
  selected: Set<string>;
  onToggleSel: (id: string) => void;
  onToggleAll: () => void;
  onConclude: (t: TaskItem) => void;
  onReopen: (t: TaskItem) => void;
  onOpen: (t: TaskItem) => void;
}) {
  if (items.length === 0) return <Empty />;
  return (
    <div className="overflow-x-auto rounded-2xl border border-line">
      <table className="w-full min-w-[880px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-line bg-canvas text-left text-xs text-muted">
            <th className="w-9 px-3 py-2.5"><input type="checkbox" checked={selected.size === items.length && items.length > 0} onChange={onToggleAll} className="h-4 w-4 rounded border-line accent-brand-600" /></th>
            <th className="w-9 px-2 py-2.5"></th>
            <th className="px-3 py-2.5 font-medium">Assunto</th>
            <th className="px-3 py-2.5 font-medium">Negócio</th>
            <th className="px-3 py-2.5 font-medium">Prioridade</th>
            <th className="px-3 py-2.5 font-medium">Contato</th>
            <th className="px-3 py-2.5 font-medium">Vencimento</th>
            <th className="px-3 py-2.5 font-medium">Tipo</th>
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const meta = TYPE_META[typeOf(t)];
            const Icon = meta.icon;
            const overdue = isOverdue(t, now);
            const done = t.status === "done";
            const pr = LEAD_PRIORITIES.find((x) => x.key === (t.priority ?? "media"));
            const dur = durationOf(t);
            return (
              <tr key={t.id} className={cn("border-b border-line last:border-0 hover:bg-subtle/50", selected.has(t.id) && "bg-brand-50/40", overdue && "bg-rose-500/5")}>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selected.has(t.id)} onChange={() => onToggleSel(t.id)} className="h-4 w-4 rounded border-line accent-brand-600" />
                </td>
                <td className="px-2 py-2.5">
                  <button
                    onClick={() => (done ? onReopen(t) : onConclude(t))}
                    className={cn("flex h-5 w-5 items-center justify-center rounded-md border", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-line hover:border-brand-400")}
                    title={done ? "Reabrir" : "Concluir"}
                  >
                    {done && <Check className="h-3.5 w-3.5" />}
                  </button>
                </td>
                <td className="cursor-pointer px-3 py-2.5" onClick={() => onOpen(t)}>
                  <span className={cn("inline-flex items-center gap-2", done && "text-muted line-through")}>
                    <span className={cn("flex h-6 w-6 items-center justify-center rounded-lg", meta.chip)}><Icon className="h-3.5 w-3.5" /></span>
                    <span className="font-medium text-ink">{t.title}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {t.leadId ? (
                    <Link href={`/gerencial/crm/${t.leadId}`} onClick={(e) => e.stopPropagation()} className="text-muted hover:text-ink hover:underline">{t.dealName}</Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {pr && (t.priority === "alta" || t.priority === "urgente") && (
                    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold", pr.chip)}><span className={cn("h-1.5 w-1.5 rounded-full", pr.dot)} /> {pr.label}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-muted">
                  {t.contactName ?? "—"}
                  {t.contactPhone && <span className="block text-[11px]">{t.contactPhone}</span>}
                </td>
                <td className={cn("px-3 py-2.5", overdue ? "font-semibold text-rose-500" : "text-muted")}>
                  {t.dueDate ? `${dayMonth(t.dueDate)} ${clockLabel(t.dueDate)}` : "—"}
                  {dur > 0 && <span className="block text-[11px] text-muted">{dur} min</span>}
                </td>
                <td className="px-3 py-2.5">
                  <span className="inline-flex items-center gap-1 text-xs text-muted"><span className={cn("h-2 w-2 rounded-full", meta.dot)} /> {meta.label}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── Foco do dia ───────────────────────────────────────── */

function FocusView({ items, now, onConclude, onOpen }: { items: TaskItem[]; now: Date; onConclude: (t: TaskItem) => void; onOpen: (t: TaskItem) => void }) {
  if (items.length === 0) return <Empty label="Tudo em dia. Nenhuma ação pendente. 🎯" />;
  return (
    <div className="mx-auto max-w-2xl space-y-2">
      {items.map((t) => {
        const meta = TYPE_META[typeOf(t)];
        const Icon = meta.icon;
        const overdue = isOverdue(t, now);
        return (
          <div key={t.id} className={cn("flex items-center gap-3 rounded-2xl border bg-surface p-3", overdue ? "border-rose-500/30" : "border-line")}>
            <button onClick={() => onConclude(t)} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line hover:border-brand-400" title="Concluir">
              <Check className="h-4 w-4 text-transparent hover:text-brand-500" />
            </button>
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}><Icon className="h-4 w-4" /></span>
            <button className="min-w-0 flex-1 text-left" onClick={() => onOpen(t)}>
              <p className="truncate text-sm font-medium text-ink">{t.title}</p>
              <p className="truncate text-xs text-muted">{t.dealName}{t.dueDate ? ` · ${clockLabel(t.dueDate)}` : ""}</p>
            </button>
            {overdue && <span className="shrink-0 rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-600">vencida</span>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Calendário ────────────────────────────────────────── */

function CalendarView({ items, now, onOpen, onCreate }: { items: TaskItem[]; now: Date; onOpen: (t: TaskItem) => void; onCreate: (iso: string) => void }) {
  const [mode, setMode] = useState<"semana" | "mes">("semana");
  const [anchor, setAnchor] = useState(() => startOfDay(now));

  const byDay = useMemo(() => {
    const m = new Map<string, TaskItem[]>();
    for (const t of items) {
      if (!t.dueDate) continue;
      const key = startOfDay(new Date(t.dueDate)).toDateString();
      (m.get(key) ?? m.set(key, []).get(key)!).push(t);
    }
    for (const arr of m.values()) arr.sort((a, b) => Date.parse(a.dueDate!) - Date.parse(b.dueDate!));
    return m;
  }, [items]);

  const shift = (days: number) => setAnchor((a) => new Date(a.getTime() + days * DAY));

  if (mode === "semana") {
    const monday = new Date(anchor); monday.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
    const days = Array.from({ length: 7 }, (_, i) => new Date(monday.getTime() + i * DAY));
    return (
      <div className="space-y-2">
        <CalHeader mode={mode} setMode={setMode} label={`${dayMonth(days[0].toISOString())} – ${dayMonth(days[6].toISOString())}`} onPrev={() => shift(-7)} onNext={() => shift(7)} />
        <div className="grid grid-cols-7 gap-2">
          {days.map((d) => {
            const list = byDay.get(d.toDateString()) ?? [];
            const isToday = sameDay(d, now);
            return (
              <div key={d.toISOString()} className={cn("min-h-[140px] rounded-xl border p-1.5", isToday ? "border-brand-400 bg-brand-50/30" : "border-line")}>
                <button onClick={() => onCreate(new Date(d.getTime() + 9 * 3600000).toISOString())} className="mb-1 block w-full text-left text-[11px] font-semibold text-muted hover:text-ink">
                  {d.toLocaleDateString("pt-BR", { weekday: "short" })} {d.getDate()}
                </button>
                <div className="space-y-1">
                  {list.map((t) => { const meta = TYPE_META[typeOf(t)]; return (
                    <button key={t.id} onClick={() => onOpen(t)} className={cn("flex w-full items-center gap-1 rounded px-1.5 py-1 text-left text-[11px]", meta.chip)}>
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} />
                      <span className="truncate">{t.dueDate ? clockLabel(t.dueDate) + " " : ""}{t.title}</span>
                    </button>
                  ); })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mês
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const gridStart = new Date(first.getTime() - startPad * DAY);
  const cells = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getTime() + i * DAY));
  return (
    <div className="space-y-2">
      <CalHeader mode={mode} setMode={setMode} label={anchor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })} onPrev={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1))} onNext={() => setAnchor(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1))} />
      <div className="grid grid-cols-7 gap-1">
        {["seg", "ter", "qua", "qui", "sex", "sáb", "dom"].map((d) => <div key={d} className="px-1 py-1 text-center text-[10px] font-semibold uppercase text-muted">{d}</div>)}
        {cells.map((d) => {
          const list = byDay.get(d.toDateString()) ?? [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = sameDay(d, now);
          return (
            <button key={d.toISOString()} onClick={() => onCreate(new Date(d.getTime() + 9 * 3600000).toISOString())} className={cn("min-h-[76px] rounded-lg border p-1 text-left align-top", isToday ? "border-brand-400 bg-brand-50/30" : "border-line", !inMonth && "opacity-40")}>
              <span className="text-[11px] font-semibold text-muted">{d.getDate()}</span>
              <div className="mt-0.5 space-y-0.5">
                {list.slice(0, 3).map((t) => { const meta = TYPE_META[typeOf(t)]; return (
                  <span key={t.id} onClick={(e) => { e.stopPropagation(); onOpen(t); }} className="flex items-center gap-1 truncate text-[10px] text-ink">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", meta.dot)} /> <span className="truncate">{t.title}</span>
                  </span>
                ); })}
                {list.length > 3 && <span className="text-[10px] text-muted">+{list.length - 3}</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CalHeader({ mode, setMode, label, onPrev, onNext }: { mode: "semana" | "mes"; setMode: (m: "semana" | "mes") => void; label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1">
        <button onClick={onPrev} title="Período anterior" aria-label="Período anterior" className="rounded-lg p-1.5 text-muted hover:bg-subtle"><ChevronLeft className="h-4 w-4" /></button>
        <span className="min-w-[160px] text-center text-sm font-semibold capitalize text-ink">{label}</span>
        <button onClick={onNext} title="Próximo período" aria-label="Próximo período" className="rounded-lg p-1.5 text-muted hover:bg-subtle"><ChevronRight className="h-4 w-4" /></button>
      </div>
      <div className="inline-flex rounded-lg border border-line p-0.5">
        {(["semana", "mes"] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", mode === m ? "bg-ink text-surface" : "text-muted hover:bg-subtle")}>
            {m === "semana" ? "Semana" : "Mês"}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Modo foco (fila) ──────────────────────────────────── */

const CHANNEL_BY_TYPE: Record<string, string> = { ligacao: "call", whatsapp: "whatsapp", email: "email" };

function FocusCockpit({ queue, scripts, pipelines, onClose, onConclude, onRemark, onOpen }: {
  queue: TaskItem[];
  scripts: DealScript[];
  pipelines: Pipeline[];
  onClose: () => void;
  onConclude: (t: TaskItem, note?: string, channel?: string) => void;
  onRemark: (t: TaskItem, iso: string) => void;
  onOpen: (t: TaskItem) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [note, setNote] = useState("");
  const [remarking, setRemarking] = useState(false);
  const [showScript, setShowScript] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setNote(""); setShowScript(false); setRemarking(false); }, [idx]);

  const total = queue.length;
  const t = queue[idx];
  const channel = t ? CHANNEL_BY_TYPE[typeOf(t)] ?? "note" : "note";
  const digits = t?.contactPhone?.replace(/\D/g, "");
  const script = t ? suggestedScriptFor(t.dealStage ?? "", scripts) : undefined;
  const stageColor = t ? pipelines.flatMap((p) => p.stages).find((s) => s.key === t.dealStage)?.color : undefined;

  const advance = () => setIdx((i) => i + 1);
  const done = () => { if (t) onConclude(t, note, channel); advance(); };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink">
            <Zap className="h-4 w-4 text-amber-500" /> Modo foco{total ? ` · ${Math.min(idx + 1, total)} de ${total}` : ""}
          </span>
          <button onClick={onClose} title="Fechar" aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
        </div>

        {!t ? (
          <div className="py-14 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold text-ink">Fila concluída. Nada pendente. 🎉</p>
            <button onClick={onClose} className="mt-4 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">Voltar</button>
          </div>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {(() => { const meta = TYPE_META[typeOf(t)]; const Icon = meta.icon; return (
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", meta.chip)}><Icon className="h-3.5 w-3.5" /> {meta.label}</span>
                ); })()}
                {t.dealStage && (
                  <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={stageColor ? { backgroundColor: `${stageColor}1f`, color: stageColor } : undefined}>
                    {stageLabel(t.dealStage)}
                  </span>
                )}
              </div>
              <h3 className="mt-2 text-lg font-bold text-ink">{t.title}</h3>
              <button onClick={() => onOpen(t)} className="text-sm text-brand-600 hover:underline">
                {t.contactName ? `${t.contactName} · ` : ""}{t.dealName}
              </button>
              {t.dueDate && <p className="text-xs text-muted">Vence {dayMonth(t.dueDate)} {clockLabel(t.dueDate)}</p>}
            </div>

            {(digits || t.contactEmail) && (
              <div className="flex flex-wrap gap-2">
                {digits && (
                  <a href={`tel:${t.contactPhone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
                    <Phone className="h-4 w-4 text-sky-500" /> Ligar {formatPhone(t.contactPhone!)}
                  </a>
                )}
                {digits && (
                  <a href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
                    <MessageCircle className="h-4 w-4 text-emerald-500" /> WhatsApp
                  </a>
                )}
                {t.contactEmail && (
                  <a href={`mailto:${t.contactEmail}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
                    <Mail className="h-4 w-4 text-violet-500" /> E-mail
                  </a>
                )}
              </div>
            )}

            {script && (
              <div className="rounded-xl border border-line bg-canvas p-3">
                <button onClick={() => setShowScript((s) => !s)} className="flex w-full items-center justify-between text-left text-sm font-semibold text-ink">
                  <span className="inline-flex items-center gap-1.5"><FileText className="h-4 w-4 text-brand-500" /> {script.title}</span>
                  <span className="text-xs text-brand-600">{showScript ? "ocultar" : "ver roteiro"}</span>
                </button>
                {showScript && (
                  <>
                    <pre className="mt-2 whitespace-pre-wrap font-sans text-xs text-muted">{script.body}</pre>
                    <button onClick={() => setNote((n) => (n ? n + "\n\n" : "") + script.body)} className="mt-2 rounded-lg border border-line px-2.5 py-1 text-xs text-brand-600 hover:bg-subtle">Usar no registro</button>
                  </>
                )}
              </div>
            )}

            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Registrar resultado</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="O que aconteceu? (vira interação no negócio)" className={drawerInput + " resize-y"} />
            </div>
          </div>
        )}

        {t && (
          <div className="border-t border-line px-5 py-3">
            {remarking ? (
              <div className="flex items-center gap-2">
                <input type="datetime-local" onChange={(e) => { if (e.target.value) { onRemark(t, new Date(e.target.value).toISOString()); advance(); } }} className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm" />
                <button onClick={() => setRemarking(false)} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-subtle">Cancelar</button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button onClick={done} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
                  <Check className="h-4 w-4" /> Concluir e próxima
                </button>
                <button onClick={() => setRemarking(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-ink hover:bg-subtle"><CalendarClock className="h-4 w-4" /> Remarcar</button>
                <button onClick={advance} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2.5 text-sm font-medium text-muted hover:bg-subtle"><SkipForward className="h-4 w-4" /> Pular</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Barra de ações em massa ───────────────────────────── */

function BulkBar({ count, team, busy, onConclude, onRemark, onReassign, onPriority, onDelete, onClear }: {
  count: number; team: string[]; busy: boolean;
  onConclude: () => void; onRemark: (iso: string) => void; onReassign: (n: string) => void; onPriority: (p: string) => void; onDelete: () => void; onClear: () => void;
}) {
  const [remark, setRemark] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-50/50 px-3 py-2">
      <span className="text-sm font-semibold text-ink">{count} selecionada{count > 1 ? "s" : ""}</span>
      <button onClick={onConclude} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60"><Check className="h-3.5 w-3.5" /> Concluir</button>
      {remark ? (
        <input type="datetime-local" autoFocus onChange={(e) => { if (e.target.value) { onRemark(new Date(e.target.value).toISOString()); setRemark(false); } }} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs" />
      ) : (
        <button onClick={() => setRemark(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"><CalendarClock className="h-3.5 w-3.5" /> Remarcar</button>
      )}
      <select onChange={(e) => { if (e.target.value) onReassign(e.target.value); e.currentTarget.selectedIndex = 0; }} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink">
        <option value="">Reatribuir…</option>
        {team.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      <select onChange={(e) => { if (e.target.value) onPriority(e.target.value); e.currentTarget.selectedIndex = 0; }} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink">
        <option value="">Prioridade…</option>
        <option value="alta">Alta</option>
        <option value="media">Normal</option>
        <option value="baixa">Baixa</option>
      </select>
      {confirmDel ? (
        <span className="inline-flex items-center gap-1.5">
          <button onClick={onDelete} disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60">Excluir</button>
          <button onClick={() => setConfirmDel(false)} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-subtle">Cancelar</button>
        </span>
      ) : (
        <button onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" /> Excluir</button>
      )}
      <button onClick={onClear} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-ink"><X className="h-3.5 w-3.5" /> limpar</button>
    </div>
  );
}

/* ── Drawer criar/editar (task ficha) ──────────────────── */

const DUE_SHORTCUTS: { label: string; days: number }[] = [
  { label: "Hoje", days: 0 }, { label: "Amanhã", days: 1 }, { label: "Em 3 dias", days: 3 }, { label: "Próx. semana", days: 7 },
];
const drawerInput = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

function TaskDrawer({ task, create, deals, team, currentUser, scripts, onClose, onSaved, onConclude }: {
  task?: TaskItem; create?: boolean;
  deals: { id: string; name: string }[];
  team: string[]; currentUser: string; scripts: DealScript[];
  onClose: () => void; onSaved: () => void; onConclude: (note?: string) => void;
}) {
  const editing = Boolean(task?.id);
  const [dealId, setDealId] = useState(task?.leadId ?? "");
  const [type, setType] = useState(task ? typeOf(task) : "ligacao");
  const [title, setTitle] = useState(task?.title ?? "");
  const [dueDate, setDueDate] = useState(task?.dueDate ? task.dueDate.slice(0, 10) : "");
  const [dueTime, setDueTime] = useState(task?.dueDate ? new Date(task.dueDate).toISOString().slice(11, 16) : "09:00");
  const [priority, setPriority] = useState<string>(task?.priority ?? "media");
  const [reminder, setReminder] = useState(String(task?.properties?.reminder ?? "no-horario"));
  const [recurrence, setRecurrence] = useState(String(task?.properties?.recurrence ?? "nenhuma"));
  const [duration, setDuration] = useState(String(durationOf(task ?? ({} as TaskItem)) || ""));
  const [assignee, setAssignee] = useState(task?.assignees?.[0] ?? task?.assignee ?? currentUser);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slashIdx, setSlashIdx] = useState(0);

  const suggested = suggestedScriptFor(task?.dealStage ?? "", scripts);
  const activeScripts = scripts.filter((s) => s.isActive !== false && s.command);
  const slashQ = note.trimStart();
  const showSlash = slashQ.startsWith("/");
  const slashMatches = showSlash ? activeScripts.filter((s) => s.command.startsWith(slashQ.split(/\s/)[0].toLowerCase())) : [];
  const slashActive = Math.min(slashIdx, Math.max(0, slashMatches.length - 1));
  function inject(s: DealScript) { setNote((showSlash ? "" : note ? note + "\n\n" : "") + s.body + "\n"); setSlashIdx(0); }
  function onNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!showSlash || slashMatches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSlashIdx((i) => Math.min(i + 1, slashMatches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSlashIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); inject(slashMatches[slashActive]); }
    else if (e.key === "Escape") { e.preventDefault(); setNote(note.replace(/^\s*\/\S*\s?/, "")); }
  }

  function applyShortcut(days: number) { const d = new Date(); d.setDate(d.getDate() + days); setDueDate(d.toISOString().slice(0, 10)); }
  const dueIso = () => (dueDate ? new Date(`${dueDate}T${dueTime || "09:00"}`).toISOString() : undefined);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    setErr(null);
    const properties: Record<string, unknown> = {
      reminder: reminder === "sem" ? undefined : reminder,
      // Recorrência não se aplica a toques avulsos (ligação/whatsapp/e-mail).
      recurrence: recurrence === "nenhuma" || ["ligacao", "whatsapp", "email"].includes(type) ? undefined : recurrence,
      duration_min: duration ? Number(duration) : undefined,
    };
    try {
      let res: Response | null;
      if (create) {
        res = await postTask({
          action: "add",
          leadId: dealId || undefined,
          title: title.trim(),
          dueDate: dueIso(),
          priority,
          type,
          properties,
          assignees: assignee ? [assignee] : [],
        });
      } else if (task?.id) {
        res = await postTask({ action: "update", taskId: task.id, title: title.trim(), dueDate: dueIso() ?? "", priority, type, properties });
      } else {
        setBusy(false);
        return;
      }
      // withToast já avisou em falha de rede/servidor; só interrompe.
      if (!res || !res.ok) {
        const out = res ? ((await res.json().catch(() => ({}))) as { error?: string }) : {};
        setErr(out.error ?? "Não foi possível salvar a atividade.");
        setBusy(false);
        return;
      }
      // Responsável (só na edição; no create já vai no add).
      if (!create && task?.id && assignee) {
        await postTask({ action: "set-assignees", taskId: task.id, assignees: [assignee] }).catch(() => {});
      }
      setBusy(false);
      onSaved();
    } catch {
      setErr("Erro de rede ao salvar.");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-bold text-ink">{create ? "Nova atividade" : "Atividade"}</h2>
          <button onClick={onClose} title="Fechar" aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle"><X className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
          {create ? (
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-muted">Negócio (opcional)</span>
              <select value={dealId} onChange={(e) => setDealId(e.target.value)} className={drawerInput}>
                <option value="">Sem negócio (avulsa)</option>
                {deals.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          ) : task?.leadId ? (
            <Link href={`/gerencial/crm/${task.leadId}`} className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">{task.dealName} →</Link>
          ) : null}

          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="O que precisa ser feito?" className={drawerInput} />

          <div>
            <p className="mb-1 text-[11px] font-medium text-muted">Tipo</p>
            <div className="flex flex-wrap gap-1.5">
              {TASK_TYPES.map((ty) => (
                <button key={ty.key} onClick={() => setType(ty.key)} className={cn("rounded-full px-2.5 py-1 text-xs font-medium", type === ty.key ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")}>{ty.label}</button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted"><Clock className="h-3.5 w-3.5" /> Vencimento</p>
            <div className="mb-1.5 flex flex-wrap gap-1.5">
              {DUE_SHORTCUTS.map((s) => <button key={s.label} onClick={() => applyShortcut(s.days)} className="rounded-full bg-subtle px-2.5 py-1 text-xs text-muted hover:bg-subtle-strong">{s.label}</button>)}
            </div>
            <div className="flex gap-2">
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={drawerInput} />
              <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} className="w-28 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted"><Bell className="h-3 w-3" /> Lembrete</span>
              <select value={reminder} onChange={(e) => setReminder(e.target.value)} className={drawerInput}><option value="30min">30 min antes</option><option value="1h">1h antes</option><option value="no-horario">No horário</option><option value="sem">Sem</option></select>
            </label>
            <label className="block"><span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted"><Flag className="h-3 w-3" /> Prioridade</span>
              <select value={priority} onChange={(e) => setPriority(e.target.value)} className={drawerInput}><option value="baixa">Baixa</option><option value="media">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option></select>
            </label>
            {!["ligacao", "whatsapp", "email"].includes(type) && (
              <label className="block"><span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted"><RefreshCw className="h-3 w-3" /> Recorrência</span>
                <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className={drawerInput}><option value="nenhuma">Não repetir</option><option value="diaria">Diária</option><option value="semanal">Semanal</option><option value="mensal">Mensal</option></select>
              </label>
            )}
            <label className="block"><span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted"><Clock className="h-3 w-3" /> Duração (min)</span>
              <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" className={drawerInput} />
            </label>
          </div>

          <label className="block"><span className="mb-1 inline-flex items-center gap-1 text-[11px] font-medium text-muted"><Users className="h-3 w-3" /> Responsável</span>
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={drawerInput}>
              {currentUser && !team.includes(currentUser) && <option value={currentUser}>{currentUser} (você)</option>}
              {team.map((n) => <option key={n} value={n}>{n}{n === currentUser ? " (você)" : ""}</option>)}
            </select>
          </label>

          {editing && (
            <div className="relative">
              <p className="mb-1 text-[11px] font-medium text-muted">Anotação {suggested && <span className="text-brand-500">· digite / p/ roteiros</span>}</p>
              {showSlash && slashMatches.length > 0 && (
                <div className="absolute bottom-full left-0 z-10 mb-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg" role="listbox">
                  {slashMatches.map((s, i) => (
                    <button
                      key={s.id ?? s.command}
                      type="button"
                      onClick={() => inject(s)}
                      onMouseEnter={() => setSlashIdx(i)}
                      role="option"
                      aria-selected={i === slashActive}
                      className={cn("flex w-full items-start gap-2 px-3 py-2 text-left text-sm", i === slashActive ? "bg-subtle" : "hover:bg-subtle")}
                    >
                      <Zap className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /><span className="min-w-0"><span className="font-medium text-ink">{s.command}</span><span className="block text-[11px] text-muted">{s.title}</span></span>
                    </button>
                  ))}
                </div>
              )}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={onNoteKeyDown} rows={4} placeholder="O que foi conversado nesta tarefa…  (digite / para roteiros — ↑↓ e Enter)" className={drawerInput + " resize-y"} />
            </div>
          )}
        </div>

        {err && (
          <p className="border-t border-line bg-rose-50 px-4 py-2 text-xs text-rose-600">{err}</p>
        )}
        <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
          {editing ? (
            <Button variant="success" size="sm" onClick={() => onConclude(note)}><Check className="h-4 w-4" /> Concluir</Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={save} disabled={!title.trim()} busy={busy}>Salvar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Vazio ─────────────────────────────────────────────── */
function Empty({ label = "Nada por aqui 🎉" }: { label?: string }) {
  return <p className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">{label}</p>;
}

/* ── Aba de visão salva (estilo HubSpot) ───────────────── */
function TaskViewTab({
  active,
  onClick,
  label,
  onDelete,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  onDelete?: () => void;
}) {
  return (
    <span
      className={cn(
        "group -mb-px inline-flex shrink-0 items-center gap-1 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink",
      )}
    >
      <button type="button" onClick={onClick}>{label}</button>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded p-0.5 text-muted opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100"
          title="Excluir visão"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}
