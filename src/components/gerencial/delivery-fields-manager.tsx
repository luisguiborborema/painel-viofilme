"use client";

import { useEffect, useState } from "react";
import { Plus, Settings2, Trash2, X } from "lucide-react";
import { DELIVERY_FIELD_TYPES, type DeliveryFieldType, type DeliveryFormField } from "@/lib/data/operacao";

export function DeliveryFieldsManager({ onClose }: { onClose: () => void }) {
  const [fields, setFields] = useState<DeliveryFormField[]>([]);
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<DeliveryFieldType>("text");
  const [optionsText, setOptionsText] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const j = await fetch("/api/gerencial/delivery-fields", { cache: "no-store" }).then((r) => r.json());
    setFields(j.fields ?? []);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial dos campos
    void load();
  }, []);

  async function create() {
    if (!label.trim() || busy) return;
    setBusy(true);
    try {
      const options =
        fieldType === "select"
          ? optionsText.split(",").map((s) => s.trim()).filter(Boolean).map((v) => ({ value: v, label: v }))
          : [];
      await fetch("/api/gerencial/delivery-fields", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", label: label.trim(), fieldType, options }),
      });
      setLabel("");
      setOptionsText("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch("/api/gerencial/delivery-fields", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    await load();
  }

  const input = "h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-semibold text-ink">Campos personalizados · Entregas</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 px-5 py-4">
          {fields.length === 0 ? (
            <p className="rounded-lg bg-subtle px-3 py-3 text-sm text-muted">Nenhum campo personalizado ainda.</p>
          ) : (
            <ul className="divide-y divide-line">
              {fields.map((f) => (
                <li key={f.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-ink">{f.label}</p>
                    <p className="text-[11px] text-muted">{DELIVERY_FIELD_TYPES.find((t) => t.key === f.fieldType)?.label}{f.options.length ? ` · ${f.options.map((o) => o.label).join(", ")}` : ""}</p>
                  </div>
                  <button onClick={() => remove(f.id)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl border border-line bg-subtle/40 p-3">
            <p className="mb-2 text-xs font-semibold text-ink">Novo campo</p>
            <div className="flex flex-wrap gap-2">
              <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Nome do campo" className={`${input} flex-1`} />
              <select value={fieldType} onChange={(e) => setFieldType(e.target.value as DeliveryFieldType)} className={input}>
                {DELIVERY_FIELD_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            {fieldType === "select" && (
              <input value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder="Opções separadas por vírgula" className={`${input} mt-2 w-full`} />
            )}
            <button onClick={create} disabled={busy || !label.trim()} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              <Plus className="h-3.5 w-3.5" /> Adicionar campo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
