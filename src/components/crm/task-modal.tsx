"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, ListTodo, X } from "lucide-react";
import type { CrmTask, PropertyDef } from "@/lib/data/crm";
import { ObjectProperties } from "./object-properties";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

function toLocal(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export function TaskModal({
  task,
  dealName,
  properties,
  team = [],
  onClose,
}: {
  task: CrmTask;
  dealName?: string;
  properties: PropertyDef[];
  team?: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(task.title);
  const [due, setDue] = useState(toLocal(task.dueDate));
  const [status, setStatus] = useState(task.status);
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [saving, setSaving] = useState(false);

  const taskProps = properties.filter((p) => p.objectType === "task");

  async function saveFields() {
    setSaving(true);
    await fetch("/api/crm/object", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        objectType: "task",
        id: task.id,
        fields: {
          title: title.trim(),
          due_date: due ? new Date(due).toISOString() : null,
          status,
          assignee: assignee || null,
        },
      }),
    }).catch(() => {});
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <ListTodo className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Tarefa</h2>
              {dealName && (
                <Link
                  href={`/gerencial/crm/${task.leadId}`}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-ink"
                >
                  {dealName} <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">Título</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-muted">Prazo</span>
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} />
            </label>
            <label className="block">
              <span className="mb-0.5 block text-[11px] font-medium text-muted">Responsável</span>
              <select value={assignee} onChange={(e) => setAssignee(e.target.value)} className={inputCls}>
                <option value="">— (dono do negócio)</option>
                {team.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => setStatus((s) => (s === "done" ? "pending" : "done"))}
              className={
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium " +
                (status === "done"
                  ? "bg-emerald-500/15 text-emerald-600"
                  : "border border-line text-muted hover:bg-subtle")
              }
            >
              <Check className="h-4 w-4" /> {status === "done" ? "Concluída" : "Marcar concluída"}
            </button>
            <button
              onClick={saveFields}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Salvar
            </button>
          </div>

          {taskProps.length > 0 && (
            <ObjectProperties
              objectType="task"
              id={task.id}
              defs={taskProps}
              initialValues={task.properties ?? {}}
              title="Propriedades da tarefa"
            />
          )}
        </div>
      </div>
    </div>
  );
}
