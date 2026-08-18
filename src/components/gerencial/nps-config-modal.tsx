"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { NPS_DEFAULTS } from "@/lib/data/nps";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

/** Edita os textos da pesquisa de NPS (a escala 0–10 é fixa). */
export function NpsConfigModal({ onClose }: { onClose: () => void }) {
  const [f, setF] = useState({ headline: "", intro: "", commentLabel: "", thankYou: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    fetch("/api/gerencial/nps-config", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const c = j?.config ?? NPS_DEFAULTS;
        setF({ headline: c.headline ?? "", intro: c.intro ?? "", commentLabel: c.commentLabel ?? "", thankYou: c.thankYou ?? "" });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/nps-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(f),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) toast(j?.error ?? "Não foi possível salvar.", "error");
      else {
        toast("Perguntas do NPS salvas.", "success");
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Personalizar pesquisa de NPS"
      description="Edite os textos. A escala de 0 a 10 é fixa (padrão NPS). Vazio usa o texto padrão."
      footer={
        <button
          onClick={save}
          disabled={busy || loading}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
        </button>
      }
    >
      {loading ? (
        <p className="flex items-center gap-2 py-6 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</p>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className={labelCls}>Pergunta principal</span>
            <textarea value={f.headline} onChange={(e) => set("headline", e.target.value)} rows={2} placeholder={NPS_DEFAULTS.headline} className={inputCls + " resize-y"} />
          </label>
          <label className="block">
            <span className={labelCls}>Introdução (subtítulo)</span>
            <input value={f.intro} onChange={(e) => set("intro", e.target.value)} placeholder="Padrão: Pesquisa de satisfação · <cliente>" className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Rótulo do comentário</span>
            <input value={f.commentLabel} onChange={(e) => set("commentLabel", e.target.value)} placeholder={NPS_DEFAULTS.commentLabel} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Mensagem de agradecimento</span>
            <textarea value={f.thankYou} onChange={(e) => set("thankYou", e.target.value)} rows={2} placeholder={NPS_DEFAULTS.thankYou} className={inputCls + " resize-y"} />
          </label>
        </div>
      )}
    </Modal>
  );
}
