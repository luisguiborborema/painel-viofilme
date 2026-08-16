"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImageIcon, Loader2, Plus, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import type { DeckConfig } from "@/lib/data/deck";

const inp = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

/** Personaliza (por cliente) a apresentação: cores, variáveis, capa, rodapé e textos. */
export function DeckConfigButton({
  clientId,
  initial,
  autoVars = {},
}: {
  clientId: string;
  initial: DeckConfig;
  autoVars?: Record<string, string>;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cfg, setCfg] = useState<DeckConfig>(() => structuredClone(initial));

  const setTheme = (k: "blue" | "lime" | "dark", v: string) =>
    setCfg((c) => ({ ...c, theme: { ...c.theme, [k]: v } }));
  const setItem = (i: number, v: string) =>
    setCfg((c) => ({ ...c, metodo: { ...c.metodo, items: c.metodo.items.map((x, j) => (j === i ? v : x)) } }));
  const setFlow = (i: number, v: string) =>
    setCfg((c) => ({ ...c, metodo: { ...c.metodo, flow: c.metodo.flow.map((x, j) => (j === i ? v : x)) } }));
  const setCell = (i: number, patch: Partial<{ t: string; d: string }>) =>
    setCfg((c) => ({ ...c, guia: { cells: c.guia.cells.map((x, j) => (j === i ? { ...x, ...patch } : x)) } }));
  const setVar = (i: number, patch: Partial<{ key: string; value: string }>) =>
    setCfg((c) => ({ ...c, vars: c.vars.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Selecione uma imagem.", "error");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/gerencial/task-upload", { method: "POST", body: fd });
      const j = await up.json().catch(() => null);
      if (!up.ok || !j?.url) throw new Error();
      setCfg((c) => ({ ...c, coverImageUrl: String(j.url) }));
    } catch {
      toast("Não foi possível subir a imagem.", "error");
    } finally {
      setUploading(false);
    }
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
      toast("Não foi possível salvar a apresentação.", "error");
    } finally {
      setBusy(false);
    }
  }

  const autoKeys = Object.keys(autoVars);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <SlidersHorizontal className="h-4 w-4" /> Personalizar
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Personalizar apresentação"
        description="Cores, variáveis, imagem de capa e textos deste cliente. Em branco = usa o padrão."
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
          {/* Cores */}
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Cores do tema</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { k: "blue", label: "Primária" },
                { k: "lime", label: "Destaque" },
                { k: "dark", label: "Escuro" },
              ] as const).map(({ k, label }) => (
                <div key={k}>
                  <span className="mb-0.5 block text-[11px] text-muted">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={cfg.theme[k]}
                      onChange={(e) => setTheme(k, e.target.value)}
                      className="h-8 w-9 shrink-0 cursor-pointer rounded border border-line bg-surface"
                    />
                    <input value={cfg.theme[k]} onChange={(e) => setTheme(k, e.target.value)} className={inp} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Imagem de capa */}
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Imagem de capa</p>
            <div className="flex items-center gap-3">
              {cfg.coverImageUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cfg.coverImageUrl} alt="" className="h-16 w-24 rounded-lg border border-line object-cover" />
                  <button
                    onClick={() => setCfg((c) => ({ ...c, coverImageUrl: undefined }))}
                    className="absolute -right-1.5 -top-1.5 rounded-full bg-rose-500 p-0.5 text-white"
                    aria-label="Remover capa"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex h-16 w-24 items-center justify-center rounded-lg border border-dashed border-line text-muted">
                  <ImageIcon className="h-5 w-5" />
                </div>
              )}
              <button
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
                {cfg.coverImageUrl ? "Trocar imagem" : "Enviar imagem"}
              </button>
              <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
            </div>
          </section>

          {/* Variáveis */}
          <section>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Variáveis</p>
              <button
                onClick={() => setCfg((c) => ({ ...c, vars: [...c.vars, { key: "", value: "" }] }))}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600 hover:underline"
              >
                <Plus className="h-3 w-3" /> Adicionar
              </button>
            </div>
            <p className="mb-2 rounded-lg bg-subtle px-2.5 py-1.5 text-[11px] text-muted">
              Use <code className="font-semibold text-ink">{"{{chave}}"}</code> ou <code className="font-semibold text-ink">[chave]</code> em qualquer texto.
              {autoKeys.length > 0 && <> Já disponíveis: {autoKeys.map((k) => `{{${k}}}`).join(", ")}.</>}
            </p>
            {cfg.vars.length > 0 && (
              <div className="space-y-1.5">
                {cfg.vars.map((v, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] items-center gap-1.5">
                    <input value={v.key} onChange={(e) => setVar(i, { key: e.target.value })} placeholder="chave (ex.: ano)" className={inp} />
                    <input value={v.value} onChange={(e) => setVar(i, { value: e.target.value })} placeholder="valor" className={inp} />
                    <button
                      onClick={() => setCfg((c) => ({ ...c, vars: c.vars.filter((_, j) => j !== i) }))}
                      className="rounded p-1 text-muted hover:text-rose-500"
                      aria-label="Remover variável"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Rodapé */}
          <section>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Contato (rodapé)</p>
            <input value={cfg.contact} onChange={(e) => setCfg((c) => ({ ...c, contact: e.target.value }))} className={inp} />
          </section>

          {/* Método */}
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

          {/* Guia */}
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
