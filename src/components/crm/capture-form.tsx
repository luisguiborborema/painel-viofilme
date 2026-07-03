"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none focus:border-brand-400";

export function CaptureForm({ slug, title }: { slug: string; title: string }) {
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!f.name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...f }),
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
        <h1 className="mt-4 text-lg font-bold text-ink">Recebemos seu contato!</h1>
        <p className="mt-1 text-sm text-muted">Em breve nossa equipe fala com você.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-lg">
      <h1 className="text-xl font-bold text-ink">{title}</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Deixe seus dados que retornamos rapidinho.</p>

      <div className="space-y-3">
        <input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Seu nome *" className={inputCls} required />
        <input value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Empresa" className={inputCls} />
        <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="E-mail" className={inputCls} />
        <input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="WhatsApp (5527999998888)" inputMode="tel" className={inputCls} />
        <textarea value={f.message} onChange={(e) => set("message", e.target.value)} placeholder="Como podemos ajudar?" rows={3} className={inputCls + " resize-none"} />
        {/* Honeypot: escondido para humanos, preenchido por bots */}
        <input
          value={f.website}
          onChange={(e) => set("website", e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="hidden"
          aria-hidden
        />
      </div>

      {error && <p className="mt-3 text-xs text-rose-500">Ops, algo deu errado. Tente de novo.</p>}

      <button
        type="submit"
        disabled={busy || !f.name.trim()}
        className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar
      </button>
    </form>
  );
}
