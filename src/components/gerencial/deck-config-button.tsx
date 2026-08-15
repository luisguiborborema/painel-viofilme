"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, SlidersHorizontal } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import type { DeckConfig } from "@/lib/data/deck";

const inp = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

/** Personaliza (por cliente) os textos dos slides Método e Guia de produção. */
export function DeckConfigButton({ clientId, initial }: { clientId: string; initial: DeckConfig }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cfg, setCfg] = useState<DeckConfig>(() => structuredClone(initial));

  function setItem(i: number, v: string) {
    setCfg((c) => ({ ...c, metodo: { ...c.metodo, items: c.metodo.items.map((x, j) => (j === i ? v : x)) } }));
  }
  function setFlow(i: number, v: string) {
    setCfg((c) => ({ ...c, metodo: { ...c.metodo, flow: c.metodo.flow.map((x, j) => (j === i ? v : x)) } }));
  }
  function setCell(i: number, patch: Partial<{ t: string; d: string }>) {
    setCfg((c) => ({ ...c, guia: { cells: c.guia.cells.map((x, j) => (j === i ? { ...x, ...patch } : x)) } }));
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/gerencial/client-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, config: cfg }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 1400);
      window.setTimeout(() => setOpen(false), 500);
    } catch {
      toast("Não foi possível salvar os textos da apresentação.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <SlidersHorizontal className="h-4 w-4" /> Personalizar textos
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Textos da apresentação"
        description="Personaliza os slides Método Viofilme e Guia de produção deste cliente. Em branco = usa o padrão."
        size="lg"
        footer={
          <button
            onClick={save}
            disabled={busy}
            className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
            {saved ? "Salvo" : "Salvar"}
          </button>
        }
      >
        <div className="space-y-5">
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Método — checklist (01 a 05)</p>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {cfg.metodo.items.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-xs font-bold text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <input value={v} onChange={(e) => setItem(i, e.target.value)} className={inp} />
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Método — destaque</p>
            <input
              value={cfg.metodo.highlightTitle}
              onChange={(e) => setCfg((c) => ({ ...c, metodo: { ...c.metodo, highlightTitle: e.target.value } }))}
              placeholder="Título do destaque"
              className={inp}
            />
            <textarea
              value={cfg.metodo.highlightText}
              onChange={(e) => setCfg((c) => ({ ...c, metodo: { ...c.metodo, highlightText: e.target.value } }))}
              rows={2}
              className={`${inp} resize-y`}
            />
          </section>

          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Método — fluxo (4 etapas)</p>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {cfg.metodo.flow.map((v, i) => (
                <input key={i} value={v} onChange={(e) => setFlow(i, e.target.value)} className={inp} />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Guia de produção (6 itens)</p>
            <div className="space-y-1.5">
              {cfg.guia.cells.map((c, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)] gap-1.5">
                  <input value={c.t} onChange={(e) => setCell(i, { t: e.target.value })} placeholder="Título" className={inp} />
                  <input value={c.d} onChange={(e) => setCell(i, { d: e.target.value })} placeholder="Descrição" className={inp} />
                </div>
              ))}
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}
