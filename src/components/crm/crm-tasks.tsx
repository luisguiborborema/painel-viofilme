"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayMonth, clockLabel } from "@/lib/datetime";
import type { PropertyDef, TaskItem } from "@/lib/data/crm";
import type { Attendant } from "@/lib/data/inbox";
import { AvatarStack } from "@/components/ui/avatar";
import { TaskModal } from "./task-modal";

/** Responsáveis de uma tarefa (array), com fallback para assignee/owner. */
function assigneesOf(t: TaskItem): string[] {
  if (t.assignees?.length) return t.assignees;
  if (t.assignee) return [t.assignee];
  return t.owner ? [t.owner] : [];
}

type Bucket = "overdue" | "today" | "week" | "later" | "nodate";

const BUCKET_META: Record<Bucket, { label: string; tone: string }> = {
  overdue: { label: "Atrasadas", tone: "text-rose-500" },
  today: { label: "Hoje", tone: "text-amber-600" },
  week: { label: "Esta semana", tone: "text-brand-600" },
  later: { label: "Depois", tone: "text-muted" },
  nodate: { label: "Sem data", tone: "text-muted" },
};
const BUCKET_ORDER: Bucket[] = ["overdue", "today", "week", "later", "nodate"];

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function bucketOf(dueIso: string | undefined, now: Date): Bucket {
  if (!dueIso) return "nodate";
  const due = new Date(dueIso);
  const t0 = startOfDay(now).getTime();
  const d0 = startOfDay(due).getTime();
  if (d0 < t0) return "overdue";
  if (d0 === t0) return "today";
  if (d0 <= t0 + 6 * 86_400_000) return "week";
  return "later";
}

async function post(body: unknown) {
  await fetch("/api/crm/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function CrmTasks({
  tasks,
  deals,
  currentUser = "",
  properties = [],
  team = [],
  teamMembers = [],
}: {
  tasks: TaskItem[];
  deals: { id: string; name: string; owner?: string }[];
  currentUser?: string;
  properties?: PropertyDef[];
  team?: string[];
  teamMembers?: Attendant[];
}) {
  const router = useRouter();
  const [mine, setMine] = useState(Boolean(currentUser));
  const [done, setDone] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<TaskItem | null>(null);
  const now = useMemo(() => new Date(), []);

  const filtered = tasks.filter(
    (t) =>
      (done ? t.status === "done" : t.status === "pending") &&
      (!mine || (t.owner ?? "") === currentUser),
  );

  const groups = useMemo(() => {
    const g: Record<Bucket, TaskItem[]> = {
      overdue: [], today: [], week: [], later: [], nodate: [],
    };
    for (const t of filtered) g[bucketOf(t.dueDate, now)].push(t);
    for (const k of BUCKET_ORDER) {
      g[k].sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
    }
    return g;
  }, [filtered, now]);

  async function toggle(t: TaskItem) {
    setBusyId(t.id);
    await post({ action: t.status === "done" ? "reopen" : "done", taskId: t.id });
    setBusyId(null);
    router.refresh();
  }

  const pendingCount = tasks.filter(
    (t) => t.status === "pending" && (!mine || (t.owner ?? "") === currentUser),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {currentUser && (
            <div className="inline-flex rounded-xl border border-line bg-canvas p-1">
              <button
                onClick={() => setMine(true)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", mine ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle")}
              >
                Minhas
              </button>
              <button
                onClick={() => setMine(false)}
                className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", !mine ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle")}
              >
                Time
              </button>
            </div>
          )}
          <button
            onClick={() => setDone((d) => !d)}
            className={cn("rounded-xl px-3 py-2 text-sm font-medium", done ? "bg-subtle text-ink" : "text-muted hover:bg-subtle")}
          >
            {done ? "Ver pendentes" : "Ver concluídas"}
          </button>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nova tarefa
        </button>
      </div>

      {!done && (
        <p className="text-sm text-muted">
          {pendingCount} tarefa{pendingCount !== 1 ? "s" : ""} pendente{pendingCount !== 1 ? "s" : ""}
        </p>
      )}

      {showNew && (
        <NewTask
          deals={deals}
          currentUser={currentUser}
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            router.refresh();
          }}
        />
      )}

      {BUCKET_ORDER.map((b) => {
        const items = groups[b];
        if (!items.length) return null;
        return (
          <section key={b}>
            <h3 className={cn("mb-1.5 text-xs font-semibold uppercase tracking-wide", BUCKET_META[b].tone)}>
              {BUCKET_META[b].label} · {items.length}
            </h3>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {items.map((t) => (
                <div
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="flex cursor-pointer items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 hover:bg-subtle"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(t); }}
                    disabled={busyId === t.id}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
                      t.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-line hover:border-brand-400",
                    )}
                    title={t.status === "done" ? "Reabrir" : "Concluir"}
                  >
                    {busyId === t.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : t.status === "done" ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("truncate text-sm font-medium", t.status === "done" ? "text-muted line-through" : "text-ink")}>
                      {t.title}
                    </p>
                    <Link
                      href={`/gerencial/crm/${t.leadId}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-muted hover:text-ink hover:underline"
                    >
                      {t.dealName}
                    </Link>
                  </div>
                  {assigneesOf(t).length > 0 && (
                    <AvatarStack names={assigneesOf(t)} team={teamMembers} size={22} />
                  )}
                  {t.dueDate && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-muted">
                      <CalendarClock className="h-3.5 w-3.5" />
                      {dayMonth(t.dueDate)} {clockLabel(t.dueDate)}
                    </span>
                  )}
                  {t.status === "done" && (
                    <button onClick={(e) => { e.stopPropagation(); toggle(t); }} className="text-muted hover:text-ink" title="Reabrir">
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {filtered.length === 0 && !showNew && (
        <div className="rounded-2xl border border-dashed border-line py-12 text-center text-sm text-muted">
          {done ? "Nenhuma tarefa concluída." : "Nenhuma tarefa pendente. 🎉"}
        </div>
      )}

      {selected && (
        <TaskModal
          task={selected}
          dealName={selected.dealName}
          properties={properties}
          team={team}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function NewTask({
  deals,
  currentUser,
  onClose,
  onCreated,
}: {
  deals: { id: string; name: string; owner?: string }[];
  currentUser: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [dealId, setDealId] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [busy, setBusy] = useState(false);

  const sorted = useMemo(
    () =>
      [...deals].sort((a, b) => {
        const am = a.owner === currentUser ? 0 : 1;
        const bm = b.owner === currentUser ? 0 : 1;
        return am - bm || a.name.localeCompare(b.name);
      }),
    [deals, currentUser],
  );

  async function save() {
    if (!dealId || !title.trim() || busy) return;
    setBusy(true);
    await post({
      action: "add",
      leadId: dealId,
      title: title.trim(),
      dueDate: due ? new Date(due).toISOString() : undefined,
    });
    setBusy(false);
    onCreated();
  }

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Nova tarefa</p>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Negócio *</span>
          <select
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            <option value="">Selecione…</option>
            {sorted.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
                {d.owner === currentUser ? " (meu)" : d.owner ? ` · ${d.owner}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Título *</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex.: Ligar para follow-up"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Prazo</span>
          <input
            type="datetime-local"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle">
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy || !dealId || !title.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Criar tarefa
        </button>
      </div>
    </div>
  );
}
