"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2, X } from "lucide-react";
import type { Pipeline, Stage } from "@/lib/data/crm";

const PRESET_COLORS = [
  "#64748b", "#0ea5e9", "#8b5cf6", "#f59e0b",
  "#10b981", "#f43f5e", "#2a63c9", "#ec4899", "#14b8a6",
];

const KIND_LABEL: Record<Stage["kind"], string> = {
  open: "Aberto",
  won: "Ganho",
  lost: "Perdido",
};

async function post(body: unknown) {
  await fetch("/api/crm/stages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function StageManager({ pipeline }: { pipeline: Pipeline }) {
  const router = useRouter();
  const stages = [...pipeline.stages].sort((a, b) => a.position - b.position);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= stages.length) return;
    setBusy(true);
    const a = stages[idx];
    const b = stages[j];
    await post({
      action: "reorder",
      orders: [
        { id: a.id, position: b.position },
        { id: b.id, position: a.position },
      ],
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await post({ action: "delete", id });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted">
          Pipeline: <span className="font-medium text-ink">{pipeline.name}</span>
        </p>
        <button
          onClick={() => setAdding((a) => !a)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Novo estágio
        </button>
      </div>

      {adding && (
        <StageForm
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      <div className="space-y-2">
        {stages.map((s, i) => (
          <StageRow
            key={s.id}
            stage={s}
            first={i === 0}
            last={i === stages.length - 1}
            busy={busy}
            onUp={() => move(i, -1)}
            onDown={() => move(i, 1)}
            onDelete={() => remove(s.id)}
            onSaved={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}

function StageRow({
  stage,
  first,
  last,
  busy,
  onUp,
  onDown,
  onDelete,
  onSaved,
}: {
  stage: Stage;
  first: boolean;
  last: boolean;
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState(stage.label);
  const [color, setColor] = useState(stage.color);
  const [prob, setProb] = useState(stage.probability);
  const [kind, setKind] = useState<Stage["kind"]>(stage.kind);
  const [saving, setSaving] = useState(false);

  const dirty =
    label !== stage.label ||
    color !== stage.color ||
    prob !== stage.probability ||
    kind !== stage.kind;

  async function save() {
    setSaving(true);
    await post({ action: "update", id: stage.id, label, color, probability: prob, kind });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-3">
      <div className="flex flex-col">
        <button
          onClick={onUp}
          disabled={first || busy}
          className="text-muted hover:text-ink disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          onClick={onDown}
          disabled={last || busy}
          className="text-muted hover:text-ink disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <div className="relative">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-8 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
          title="Cor do estágio"
        />
      </div>

      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        className="min-w-[140px] flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-brand-400"
      />

      <label className="flex items-center gap-1.5 text-xs text-muted">
        Prob.
        <input
          type="number"
          min={0}
          max={100}
          value={prob}
          onChange={(e) => setProb(Number(e.target.value))}
          className="w-16 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
        />
        %
      </label>

      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as Stage["kind"])}
        className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
      >
        {(["open", "won", "lost"] as const).map((k) => (
          <option key={k} value={k}>
            {KIND_LABEL[k]}
          </option>
        ))}
      </select>

      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Salvar"}
        </button>
      )}

      <button
        onClick={onDelete}
        disabled={busy}
        className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
        title="Excluir estágio (os negócios vão para o primeiro estágio)"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function StageForm({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [prob, setProb] = useState(30);
  const [kind, setKind] = useState<Stage["kind"]>("open");
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!label.trim() || busy) return;
    setBusy(true);
    await post({ action: "create", label: label.trim(), color, probability: prob, kind });
    setBusy(false);
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Novo estágio</p>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Nome</span>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Qualificação, Onboarding…"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <label>
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Prob. %</span>
          <input
            type="number"
            min={0}
            max={100}
            value={prob}
            onChange={(e) => setProb(Number(e.target.value))}
            className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <label>
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Tipo</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as Stage["kind"])}
            className="rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            {(["open", "won", "lost"] as const).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3">
        <span className="mb-1 block text-[11px] font-medium text-muted">Cor</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={
                "h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-canvas " +
                (color === c ? "ring-ink" : "ring-transparent")
              }
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded-lg border border-line bg-transparent p-0.5"
          />
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:bg-subtle"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={busy || !label.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Criar estágio
        </button>
      </div>
    </div>
  );
}
