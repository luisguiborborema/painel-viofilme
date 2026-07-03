"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil } from "lucide-react";
import type { CrmObjectType } from "@/lib/data/crm";

export type EditableField = {
  key: string; // coluna nativa (snake_case)
  label: string;
  type?: "text" | "tel" | "email" | "url" | "number";
  placeholder?: string;
};

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

/**
 * Edita campos NATIVOS (colunas) de um objeto do CRM via /api/crm/object.
 * Alterna entre exibição e edição; salva só o que mudou.
 */
export function EditableFields({
  objectType,
  id,
  fields,
  initial,
  title = "Dados",
}: {
  objectType: CrmObjectType;
  id: string;
  fields: EditableField[];
  initial: Record<string, unknown>;
  title?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.key, initial[f.key] == null ? "" : String(initial[f.key])])),
  );
  const [saving, setSaving] = useState(false);

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function save() {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.key];
      payload[f.key] = f.type === "number" ? (v === "" ? null : Number(v)) : v;
    }
    await fetch("/api/crm/object", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objectType, id, fields: payload }),
    }).catch(() => {});
    setSaving(false);
    setEditing(false);
    router.refresh();
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
        ) : (
          <button
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Salvar
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2.5">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-muted">
                {f.label}
              </label>
              <input
                type={f.type === "number" ? "number" : f.type ?? "text"}
                value={values[f.key]}
                onChange={(e) => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className={inputCls}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-1.5 text-sm">
          {fields.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-3 py-1">
              <span className="text-muted">{f.label}</span>
              <span className="truncate text-right text-ink">
                {values[f.key]?.trim() ? values[f.key] : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
