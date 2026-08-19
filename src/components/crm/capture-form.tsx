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
  showIfKey?: string | null;
  showIfValue?: string | null;
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

/** Faixa de marca — largura total da tela (responsiva). */
function BrandHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="relative w-full overflow-hidden bg-brand-700 text-white">
      <div
        className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full"
        style={{ background: "radial-gradient(closest-side, #e9fc8933, transparent)" }}
      />
      <div className="mx-auto w-full max-w-2xl px-5 py-7 sm:px-6 sm:py-9">
        <LogoHorizontal className="h-6 text-white sm:h-7" />
        {title && <h1 className="mt-4 text-xl font-bold leading-tight sm:text-2xl">{title}</h1>}
        {description !== undefined && (
          <p className="mt-1 text-sm text-white/70">{description || "Preencha os campos abaixo — leva poucos minutos."}</p>
        )}
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="px-4 py-6 text-center text-xs text-muted">
      Powered by <span className="font-semibold text-ink">Viofilme</span> · viofilme.com.br
    </footer>
  );
}

export function CaptureForm({
  slug,
  title,
  description,
  fields = [],
  client,
}: {
  slug: string;
  title: string;
  description?: string;
  fields?: PublicField[];
  /** Cliente vinculado via URL (?client=<id>) — o card criado fica preso a ele. */
  client?: string;
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

  // Condicional: um campo só aparece se o campo `showIfKey` tiver valor = `showIfValue`.
  const visible = (f: PublicField) =>
    !f.showIfKey || (values[f.showIfKey] ?? "") === (f.showIfValue ?? "");

  const missingRequired = activeFields.some(
    (f) => f.fieldType !== "section" && f.required && visible(f) && !((values[f.fieldKey] ?? "").trim()),
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (missingRequired || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, values, website, client }),
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
      <div className="flex min-h-screen flex-col">
        <BrandHeader title="" />
        <div className="flex flex-1 items-center justify-center px-5 py-12 text-center">
          <div>
            <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
            <h1 className="mt-4 text-xl font-bold text-ink">Recebemos suas respostas!</h1>
            <p className="mt-1 text-sm text-muted">Em breve nossa equipe dá sequência. Obrigado. 💙</p>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex min-h-screen flex-col">
      <BrandHeader title={title} description={description} />

      {/* Campos — coluna única (uma pergunta por linha), centralizada e responsiva */}
      <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-6">
        <div className="space-y-5">
          {activeFields.map((f) => {
            // Seção: divisória/título (sem input).
            if (f.fieldType === "section") {
              return (
                <h2 key={f.fieldKey} className="border-b border-line pb-1.5 pt-2 text-base font-bold text-ink first:pt-0">
                  {f.label}
                </h2>
              );
            }
            // Condicional: só renderiza se a condição estiver satisfeita.
            if (!visible(f)) return null;

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

            if (f.fieldType === "multiselect") {
              const selected = val ? val.split(",").map((s) => s.trim()).filter(Boolean) : [];
              const toggle = (v: string) => {
                const next = selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v];
                set(f.fieldKey, next.join(", "));
              };
              return (
                <fieldset key={f.fieldKey} className="block">
                  <legend className="mb-1.5 block text-sm font-medium text-ink">{f.label}{req}</legend>
                  <div className="space-y-1.5">
                    {f.options.map((o) => (
                      <label key={o.value} className="flex items-center gap-2 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={selected.includes(o.value)}
                          onChange={() => toggle(o.value)}
                          className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500/30"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            }

            let control;
            if (f.fieldType === "textarea") {
              control = (
                <textarea value={val} onChange={(e) => set(f.fieldKey, e.target.value)} rows={4} className={inputCls + " resize-none"} required={f.required} />
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
        </div>

        {error && <p className="mt-4 text-xs text-rose-500">Ops, algo deu errado. Confira os campos e tente de novo.</p>}

        <button
          type="submit"
          disabled={busy || missingRequired}
          className="mt-6 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar
        </button>
      </div>

      <Footer />
    </form>
  );
}
