"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, X } from "lucide-react";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

export function NewCompanyModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: "",
    segment: "",
    website: "",
    phone: "",
    email: "",
    city: "",
    size: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof f>(k: K, v: string) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", ...f, name: f.name.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Building2 className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold text-ink">Nova empresa</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <label className="col-span-2 block">
            <span className="mb-1 block text-xs font-medium text-muted">Nome *</span>
            <input autoFocus value={f.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Segmento</span>
            <input value={f.segment} onChange={(e) => set("segment", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Cidade</span>
            <input value={f.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Telefone</span>
            <input value={f.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">E-mail</span>
            <input value={f.email} onChange={(e) => set("email", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Website</span>
            <input value={f.website} onChange={(e) => set("website", e.target.value)} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Porte</span>
            <input value={f.size} onChange={(e) => set("size", e.target.value)} placeholder="1-10, 11-50…" className={inputCls} />
          </label>
          {error && <p className="col-span-2 text-xs text-rose-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy || !f.name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
            Criar empresa
          </button>
        </div>
      </div>
    </div>
  );
}
