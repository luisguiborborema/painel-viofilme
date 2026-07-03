"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2 } from "lucide-react";
import type { Tag } from "@/lib/data/crm";

const PRESET_COLORS = [
  "#f43f5e", "#f59e0b", "#10b981", "#0ea5e9",
  "#8b5cf6", "#2a63c9", "#ec4899", "#14b8a6", "#64748b",
];

async function post(body: unknown) {
  await fetch("/api/crm/tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

export function TagManager({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    await post({ action: "create", name: name.trim(), color });
    setName("");
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await post({ action: "delete", id });
    setBusy(false);
    router.refresh();
  }

  async function recolor(id: string, c: string) {
    await post({ action: "update", id, color: c });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-3">
        <label className="flex-1">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Nova tag</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Ex.: VIP, Reativar, Parceria…"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <div>
          <span className="mb-1 block text-[11px] font-medium text-muted">Cor</span>
          <div className="flex items-center gap-1.5">
            {PRESET_COLORS.slice(0, 6).map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className={
                  "h-6 w-6 rounded-full ring-2 ring-offset-2 ring-offset-surface " +
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
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((t) => (
          <div
            key={t.id}
            className="inline-flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2"
          >
            <label className="relative h-5 w-5 cursor-pointer">
              <span
                className="block h-5 w-5 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <input
                type="color"
                value={t.color}
                onChange={(e) => recolor(t.id, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                title="Trocar cor"
              />
            </label>
            <span className="text-sm font-medium text-ink">{t.name}</span>
            <button
              onClick={() => remove(t.id)}
              disabled={busy}
              className="rounded-full p-0.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
              title="Excluir tag"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {tags.length === 0 && (
          <p className="text-sm text-muted">Nenhuma tag ainda. Crie a primeira acima.</p>
        )}
      </div>
    </div>
  );
}
