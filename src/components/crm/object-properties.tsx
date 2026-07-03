"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import type { CrmObjectType, PropertyDef } from "@/lib/data/crm";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

function Field({
  def,
  value,
  onChange,
}: {
  def: PropertyDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  switch (def.fieldType) {
    case "checkbox":
      return (
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-brand-600"
          />
          {value ? "Sim" : "Não"}
        </label>
      );
    case "select":
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputCls}
        >
          <option value="">—</option>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "multiselect": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5">
          {def.options.map((o) => {
            const on = arr.includes(o.value);
            return (
              <button
                key={o.value}
                type="button"
                onClick={() =>
                  onChange(on ? arr.filter((v) => v !== o.value) : [...arr, o.value])
                }
                className={
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors " +
                  (on ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")
                }
              >
                {o.label}
              </button>
            );
          })}
        </div>
      );
    }
    case "number":
    case "currency":
      return (
        <input
          type="number"
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className={inputCls}
          placeholder={def.fieldType === "currency" ? "R$" : ""}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value.slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputCls}
        />
      );
    default:
      return (
        <input
          type={
            def.fieldType === "email" ? "email" : def.fieldType === "url" ? "url" : "text"
          }
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
        />
      );
  }
}

/**
 * Editor inline de propriedades customizadas de um objeto (empresa/contato/deal).
 * Salva o mapa completo via /api/crm/object (merge no servidor).
 */
export function ObjectProperties({
  objectType,
  id,
  defs,
  initialValues,
  title = "Propriedades",
}: {
  objectType: CrmObjectType;
  id: string;
  defs: PropertyDef[];
  initialValues: Record<string, unknown>;
  title?: string;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, unknown>>(initialValues ?? {});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!defs.length) return null;

  function set(key: string, v: unknown) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setDirty(true);
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/crm/object", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objectType, id, properties: values }),
      });
      setDirty(false);
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink">
        <SlidersHorizontal className="h-4 w-4" /> {title}
      </h2>
      <div className="space-y-3">
        {defs.map((def) => (
          <div key={def.id}>
            <label className="mb-0.5 block text-[11px] font-medium uppercase tracking-wide text-muted">
              {def.label}
            </label>
            <Field def={def} value={values[def.key]} onChange={(v) => set(def.key, v)} />
          </div>
        ))}
      </div>
      {(dirty || saved) && (
        <div className="mt-3 flex items-center justify-end gap-2">
          {saved && !dirty && (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
              <Check className="h-3.5 w-3.5" /> Salvo
            </span>
          )}
          {dirty && (
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              Salvar
            </button>
          )}
        </div>
      )}
    </section>
  );
}
