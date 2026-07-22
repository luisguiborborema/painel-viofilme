"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import type { DealScript } from "@/lib/data/crm";
import { EmptyState } from "./settings-ui";

type StageOption = { key: string; label: string };

async function post(body: unknown) {
  await fetch("/api/crm/scripts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

const inputCls = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

export function ScriptsManager({
  scripts,
  stageOptions = [],
}: {
  scripts: DealScript[];
  stageOptions?: StageOption[];
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    await post(payload);
    setBusy(false);
    setCreating(false);
    setEditingId(null);
    router.refresh();
  }
  async function remove(id: string) {
    setBusy(true);
    await post({ action: "delete", id });
    setBusy(false);
    router.refresh();
  }
  async function toggle(s: DealScript) {
    if (!s.id) return;
    await post({ action: "update", id: s.id, isActive: !(s.isActive !== false) });
    router.refresh();
  }

  const stageLabelOf = (key?: string) => stageOptions.find((o) => o.key === key)?.label ?? key;

  return (
    <div className="space-y-3">
      {!creating && (
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Adicionar script
        </button>
      )}

      {creating && (
        <ScriptEditor
          stageOptions={stageOptions}
          busy={busy}
          onCancel={() => setCreating(false)}
          onSave={(p) => save({ action: "create", ...p })}
        />
      )}

      {scripts.length === 0 && !creating ? (
        <EmptyState icon={FileText}>Nenhum script ainda. Crie o primeiro acima.</EmptyState>
      ) : (
        <div className="space-y-2">
          {scripts.map((s) =>
            editingId === s.id ? (
              <ScriptEditor
                key={s.id}
                initial={s}
                stageOptions={stageOptions}
                busy={busy}
                onCancel={() => setEditingId(null)}
                onSave={(p) => save({ action: "update", id: s.id, ...p })}
              />
            ) : (
              <div key={s.id ?? s.command} className="rounded-2xl border border-line bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-ink">{s.title}</span>
                      {s.command && (
                        <code className="rounded bg-subtle px-1.5 py-0.5 text-[11px] text-brand-600">{s.command}</code>
                      )}
                      {s.stageHint && (
                        <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] text-muted">
                          sugere: {stageLabelOf(s.stageHint)}
                        </span>
                      )}
                      {s.isActive === false && (
                        <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-semibold text-rose-500">inativo</span>
                      )}
                      {!s.id && (
                        <span className="rounded-full bg-subtle px-2 py-0.5 text-[10px] text-muted" title="Roteiro embutido (rode a migration 0071 para editar)">
                          padrão
                        </span>
                      )}
                    </div>
                    {s.hint && <p className="mt-0.5 text-xs text-muted">{s.hint}</p>}
                    <p className="mt-1.5 line-clamp-2 whitespace-pre-wrap text-xs text-muted">{s.body}</p>
                  </div>
                  {s.id && (
                    <div className="flex shrink-0 items-center gap-1">
                      <label className="mr-1 inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted">
                        <input
                          type="checkbox"
                          checked={s.isActive !== false}
                          onChange={() => toggle(s)}
                          className="h-3.5 w-3.5 rounded border-line accent-brand-600"
                        />
                        ativo
                      </label>
                      <button onClick={() => setEditingId(s.id!)} className="rounded p-1 text-muted hover:bg-subtle hover:text-ink" title="Editar">
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => remove(s.id!)}
                        disabled={busy}
                        className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

function ScriptEditor({
  initial,
  stageOptions,
  busy,
  onSave,
  onCancel,
}: {
  initial?: DealScript;
  stageOptions: StageOption[];
  busy: boolean;
  onSave: (p: { title: string; command: string; hint: string; stageHint: string; body: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [command, setCommand] = useState(initial?.command ?? "");
  const [hint, setHint] = useState(initial?.hint ?? "");
  const [stageHint, setStageHint] = useState(initial?.stageHint ?? "");
  const [body, setBody] = useState(initial?.body ?? "");
  const canSave = title.trim() && body.trim() && !busy;

  return (
    <div className="space-y-3 rounded-2xl border border-brand-400/40 bg-brand-50/30 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Título *</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Follow-up de proposta" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Comando slash</span>
          <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="/followup-proposta" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Dica (descrição curta)</span>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="Quando usar" className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Etapa sugerida</span>
          <select value={stageHint} onChange={(e) => setStageHint(e.target.value)} className={inputCls}>
            <option value="">— nenhuma —</option>
            {stageOptions.map((o) => (
              <option key={o.key} value={o.key}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className="mb-0.5 block text-[11px] font-medium text-muted">Corpo (template injetável) *</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          placeholder="Texto-guia que o SDR preenche na hora…"
          className={inputCls + " resize-y font-mono"}
        />
      </label>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted hover:bg-subtle">Cancelar</button>
        <button
          onClick={() => onSave({ title: title.trim(), command: command.trim(), hint: hint.trim(), stageHint, body })}
          disabled={!canSave}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Salvar
        </button>
      </div>
    </div>
  );
}
