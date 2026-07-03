"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import type {
  CrmObjectType,
  PropertyDef,
  PropertyFieldType,
  PropertyOption,
} from "@/lib/data/crm";

const OBJECTS: { key: CrmObjectType; label: string }[] = [
  { key: "company", label: "Empresa" },
  { key: "contact", label: "Contato" },
  { key: "deal", label: "Negócio" },
];

const FIELD_TYPES: { key: PropertyFieldType; label: string }[] = [
  { key: "text", label: "Texto" },
  { key: "number", label: "Número" },
  { key: "currency", label: "Moeda (R$)" },
  { key: "select", label: "Seleção" },
  { key: "multiselect", label: "Múltipla seleção" },
  { key: "date", label: "Data" },
  { key: "checkbox", label: "Sim/Não" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "url", label: "URL" },
];

const fieldTypeLabel = (t: string) =>
  FIELD_TYPES.find((f) => f.key === t)?.label ?? t;

export function PropertyManager({ properties }: { properties: PropertyDef[] }) {
  const router = useRouter();
  const [obj, setObj] = useState<CrmObjectType>("company");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = properties
    .filter((p) => p.objectType === obj)
    .sort((a, b) => a.position - b.position);

  async function remove(id: string) {
    setBusyId(id);
    await fetch("/api/crm/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    }).catch(() => {});
    setBusyId(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl border border-line bg-canvas p-1">
          {OBJECTS.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setObj(o.key);
                setAdding(false);
              }}
              className={
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors " +
                (obj === o.key ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle")
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAdding((a) => !a)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nova propriedade
        </button>
      </div>

      {adding && (
        <PropertyForm
          objectType={obj}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            router.refresh();
          }}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-line bg-surface">
        {list.map((p) => (
          <div
            key={p.id}
            className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">
                {p.label}
                {p.isDefault && (
                  <span className="ml-2 rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    padrão
                  </span>
                )}
              </p>
              <p className="text-xs text-muted">
                <code className="rounded bg-subtle px-1">{p.key}</code> · {fieldTypeLabel(p.fieldType)}
                {p.options.length > 0 && ` · ${p.options.length} opções`}
              </p>
            </div>
            <button
              onClick={() => remove(p.id)}
              disabled={busyId === p.id}
              className="rounded-lg p-2 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50"
              title="Excluir propriedade"
            >
              {busyId === p.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        ))}
        {list.length === 0 && !adding && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            Nenhuma propriedade customizada para {OBJECTS.find((o) => o.key === obj)?.label}.
          </p>
        )}
      </div>
    </div>
  );
}

function PropertyForm({
  objectType,
  onClose,
  onSaved,
}: {
  objectType: CrmObjectType;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<PropertyFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);

  const hasOptions = fieldType === "select" || fieldType === "multiselect";

  async function save() {
    if (!label.trim() || busy) return;
    setBusy(true);
    const options: PropertyOption[] = hasOptions
      ? optionsText
          .split(/[\n,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .map((label) => ({
            value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
            label,
          }))
      : [];
    await fetch("/api/crm/properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", objectType, label: label.trim(), fieldType, options }),
    }).catch(() => {});
    setBusy(false);
    onSaved();
  }

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-50/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">Nova propriedade</p>
        <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Rótulo</span>
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: Instagram, Faturamento…"
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          />
        </label>
        <label className="block">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Tipo de campo</span>
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as PropertyFieldType)}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
          >
            {FIELD_TYPES.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        {hasOptions && (
          <label className="block sm:col-span-2">
            <span className="mb-0.5 block text-[11px] font-medium text-muted">
              Opções (uma por linha ou separadas por vírgula)
            </span>
            <textarea
              value={optionsText}
              onChange={(e) => setOptionsText(e.target.value)}
              rows={3}
              placeholder={"Opção A\nOpção B\nOpção C"}
              className="w-full resize-none rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
            />
          </label>
        )}
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
          Criar propriedade
        </button>
      </div>
    </div>
  );
}
