"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, Workflow, X } from "lucide-react";
import type { TaskFlow } from "@/lib/data/crm";

async function post(body: unknown) {
  await fetch("/api/crm/task-flows", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function FlowManager({ flows }: { flows: TaskFlow[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function createFlow() {
    if (!name.trim() || busy) return;
    setBusy(true);
    await post({ action: "create-flow", name: name.trim() });
    setName("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 rounded-2xl border border-line bg-surface p-3">
        <label className="flex-1">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Novo fluxo</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFlow()}
            placeholder="Ex.: Onboarding, Cadência de prospecção…"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <button
          onClick={createFlow}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>

      {flows.map((f) => (
        <FlowCard key={f.id} flow={f} />
      ))}
      {flows.length === 0 && (
        <p className="text-sm text-muted">Nenhum fluxo ainda. Crie o primeiro acima.</p>
      )}
    </div>
  );
}

function FlowCard({ flow }: { flow: TaskFlow }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [dueDays, setDueDays] = useState(1);
  const [busy, setBusy] = useState(false);

  async function act(body: unknown) {
    setBusy(true);
    await post(body);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
          <Workflow className="h-4 w-4 text-brand-500" /> {flow.name}
          <span className="text-xs font-normal text-muted">({flow.steps.length} passos)</span>
        </h3>
        <button
          onClick={() => act({ action: "delete-flow", id: flow.id })}
          disabled={busy}
          className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
          title="Excluir fluxo"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <ol className="mb-2 space-y-1.5">
        {flow.steps.map((s, i) => (
          <li key={s.id} className="flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-2 text-sm">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-bold text-brand-600">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{s.title}</span>
            <span className="whitespace-nowrap text-xs text-muted">
              {s.dueDays === 0 ? "no dia" : `+${s.dueDays}d`}
            </span>
            <button
              onClick={() => act({ action: "delete-step", stepId: s.id })}
              className="rounded p-1 text-muted hover:text-rose-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-end gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nova tarefa do fluxo"
          className="min-w-[180px] flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        />
        <label className="flex items-center gap-1 text-[11px] text-muted">
          vence em
          <input
            type="number"
            min={0}
            value={dueDays}
            onChange={(e) => setDueDays(Number(e.target.value))}
            className="w-14 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
          d
        </label>
        <button
          onClick={() => {
            if (!title.trim()) return;
            act({ action: "add-step", flowId: flow.id, title: title.trim(), dueDays });
            setTitle("");
          }}
          disabled={busy || !title.trim()}
          className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Passo
        </button>
      </div>
    </div>
  );
}
