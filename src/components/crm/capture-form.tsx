"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

export type PublicField = {
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: { value: string; label: string }[];
};

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400";

// Fallback quando o formulário não tem campos configurados (compat. com os
// formulários de captação antigos): nome/empresa/e-mail/telefone/mensagem.
const LEGACY_FIELDS: PublicField[] = [
  { fieldKey: "contact_name", label: "Seu nome", fieldType: "text", required: true, options: [] },
  { fieldKey: "company", label: "Empresa", fieldType: "text", required: false, options: [] },
  { fieldKey: "contact_email", label: "E-mail", fieldType: "email", required: false, options: [] },
  { fieldKey: "contact_phone", label: "WhatsApp (5527999998888)", fieldType: "phone", required: false, options: [] },
  { fieldKey: "message", label: "Como podemos ajudar?", fieldType: "textarea", required: false, options: [] },
];

export function CaptureForm({
  slug,
  title,
  description,
  fields = [],
}: {
  slug: string;
  title: string;
  description?: string;
  fields?: PublicField[];
}) {
  const activeFields = fields.length ? fields : LEGACY_FIELDS;
  const [values, setValues] = useState<Record<string, string>>({});
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(key: string, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  const missingRequired = activeFields.some((f) => f.required && !((values[f.fieldKey] ?? "").trim()));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, values, website }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-lg">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h1 className="mt-4 text-lg font-bold text-ink">Recebemos suas respostas!</h1>
        <p className="mt-1 text-sm text-muted">Em breve nossa equipe dá sequência.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-lg">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="mb-4 mt-1 text-sm text-muted">{description || "Preencha os campos abaixo."}</p>

      <div className="space-y-3">
        {activeFields.map((f) => {
          const val = values[f.fieldKey] ?? "";
          const ph = f.label + (f.required ? " *" : "");
          if (f.fieldType === "textarea") {
            return (
              <textarea key={f.fieldKey} value={val} onChange={(e) => set(f.fieldKey, e.target.value)} placeholder={ph} rows={3} className={inputCls + " resize-none"} required={f.required} />
            );
          }
          if (f.fieldType === "select") {
            return (
              <select key={f.fieldKey} value={val} onChange={(e) => set(f.fieldKey, e.target.value)} className={inputCls} required={f.required}>
                <option value="">{ph}</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            );
          }
          if (f.fieldType === "checkbox") {
            return (
              <label key={f.fieldKey} className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={val === "true"} onChange={(e) => set(f.fieldKey, e.target.checked ? "true" : "")} />
                {f.label}
              </label>
            );
          }
          const type =
            f.fieldType === "email" ? "email" : f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : f.fieldType === "url" ? "url" : "text";
          return (
            <input
              key={f.fieldKey}
              type={type}
              inputMode={f.fieldType === "phone" ? "tel" : undefined}
              value={val}
              onChange={(e) => set(f.fieldKey, e.target.value)}
              placeholder={ph}
              className={inputCls}
              required={f.required}
            />
          );
        })}
        {/* Honeypot: escondido para humanos, preenchido por bots */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
      </div>

      {error && <p className="mt-3 text-xs text-rose-500">Ops, algo deu errado. Confira os campos e tente de novo.</p>}

      <button
        type="submit"
        disabled={busy || missingRequired}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar
      </button>
    </form>
  );
}
