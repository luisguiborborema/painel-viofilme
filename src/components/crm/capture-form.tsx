"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { LogoHorizontal } from "@/components/brand/logo";

export type PublicField = {
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
  options: { value: string; label: string }[];
};

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-brand-400 focus:ring-2 focus:ring-brand-500/15";

// Fallback quando o formulário não tem campos configurados (compat. com os
// formulários de captação antigos): nome/empresa/e-mail/telefone/mensagem.
const LEGACY_FIELDS: PublicField[] = [
  { fieldKey: "contact_name", label: "Seu nome", fieldType: "text", required: true, options: [] },
  { fieldKey: "company", label: "Empresa", fieldType: "text", required: false, options: [] },
  { fieldKey: "contact_email", label: "E-mail", fieldType: "email", required: false, options: [] },
  { fieldKey: "contact_phone", label: "WhatsApp", fieldType: "phone", required: false, options: [] },
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
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
        <div className="bg-brand-700 px-6 py-5">
          <LogoHorizontal className="h-6 text-white" />
        </div>
        <div className="p-10 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
          <h1 className="mt-4 text-xl font-bold text-ink">Recebemos suas respostas!</h1>
          <p className="mt-1 text-sm text-muted">Em breve nossa equipe dá sequência. Obrigado. 💙</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-xl">
      {/* Faixa de marca */}
      <div className="relative overflow-hidden bg-brand-700 px-6 py-6 text-white">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full"
          style={{ background: "radial-gradient(closest-side, #e9fc8933, transparent)" }}
        />
        <LogoHorizontal className="h-6 text-white" />
        <h1 className="mt-4 text-xl font-bold leading-tight">{title}</h1>
        <p className="mt-1 text-sm text-white/70">{description || "Preencha os campos abaixo — leva poucos minutos."}</p>
      </div>

      {/* Campos */}
      <div className="space-y-4 p-6">
        {activeFields.map((f) => {
          const val = values[f.fieldKey] ?? "";
          const req = f.required ? <span className="text-rose-500"> *</span> : null;

          if (f.fieldType === "checkbox") {
            return (
              <label key={f.fieldKey} className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={val === "true"}
                  onChange={(e) => set(f.fieldKey, e.target.checked ? "true" : "")}
                  className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/30"
                />
                {f.label}
                {req}
              </label>
            );
          }

          let control;
          if (f.fieldType === "textarea") {
            control = (
              <textarea value={val} onChange={(e) => set(f.fieldKey, e.target.value)} rows={3} className={inputCls + " resize-none"} required={f.required} />
            );
          } else if (f.fieldType === "select") {
            control = (
              <select value={val} onChange={(e) => set(f.fieldKey, e.target.value)} className={inputCls} required={f.required}>
                <option value="">Selecione…</option>
                {f.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            );
          } else {
            const type =
              f.fieldType === "email" ? "email" : f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : f.fieldType === "url" ? "url" : "text";
            control = (
              <input
                type={type}
                inputMode={f.fieldType === "phone" ? "tel" : undefined}
                value={val}
                onChange={(e) => set(f.fieldKey, e.target.value)}
                placeholder={f.fieldType === "phone" ? "5527999998888" : undefined}
                className={inputCls}
                required={f.required}
              />
            );
          }

          return (
            <label key={f.fieldKey} className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink">{f.label}{req}</span>
              {control}
            </label>
          );
        })}

        {/* Honeypot: escondido para humanos, preenchido por bots */}
        <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

        {error && <p className="text-xs text-rose-500">Ops, algo deu errado. Confira os campos e tente de novo.</p>}

        <button
          type="submit"
          disabled={busy || missingRequired}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar
        </button>
      </div>
    </form>
  );
}
