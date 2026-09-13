"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Pin, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAX_CONTEUDO, MAX_TAGS } from "@/lib/data/knowledge";
import type { KnowledgeCategory } from "@/lib/data/listas-server";

/**
 * Editor de página da base de conhecimento.
 *
 * A tabela existia desde a 0081 e só era lida: publicar um processo exigia
 * mexer no banco. Texto simples, de propósito — o que falta ao time é ter onde
 * escrever, não negrito.
 */
const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
const rotulo = "mb-1 block text-xs font-medium text-muted";

export type PaginaEmEdicao = {
  id?: string;
  categoryId?: string | null;
  title: string;
  summary: string;
  content: string;
  tags: string[];
  videoUrl: string;
  pinned?: boolean;
};

export const PAGINA_NOVA: PaginaEmEdicao = {
  title: "", summary: "", content: "", tags: [], videoUrl: "",
};

export function KnowledgeEditor({
  pagina, categorias, onClose,
}: {
  pagina: PaginaEmEdicao;
  categorias: KnowledgeCategory[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [f, setF] = useState<PaginaEmEdicao>(pagina);
  const [tagNova, setTagNova] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(Boolean(pagina.id));

  // A lista traz só o resumo; o conteúdo vem ao abrir.
  useEffect(() => {
    if (!pagina.id) return;
    fetch(`/api/crm/knowledge?id=${pagina.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (j?.page) setF({ ...j.page, summary: j.page.summary ?? "", content: j.page.content ?? "", videoUrl: j.page.videoUrl ?? "" });
      })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, [pagina.id]);

  async function acao(body: Record<string, unknown>) {
    setBusy(true); setErro(null);
    const res = await fetch("/api/crm/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível salvar."); return false; }
    router.refresh();
    return true;
  }

  async function salvar() {
    if (await acao({ action: "save-page", ...f })) onClose();
  }

  function addTag() {
    const t = tagNova.trim().toLowerCase();
    if (!t || f.tags.includes(t) || f.tags.length >= MAX_TAGS) { setTagNova(""); return; }
    setF({ ...f, tags: [...f.tags, t] });
    setTagNova("");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">
            {f.id ? "Editar processo" : "Novo processo"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>

        {carregando ? (
          <div className="flex justify-center p-12"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>
        ) : (
          <div className="space-y-3 px-5 py-4">
            <label className="block">
              <span className={rotulo}>Título *</span>
              <input
                value={f.title}
                onChange={(e) => setF({ ...f, title: e.target.value })}
                placeholder="Ex.: Como montar a proposta comercial"
                className={inputCls}
                autoFocus
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={rotulo}>Categoria</span>
                <select
                  value={f.categoryId ?? ""}
                  onChange={(e) => setF({ ...f, categoryId: e.target.value || null })}
                  className={inputCls}
                >
                  <option value="">— sem categoria —</option>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={rotulo}>Vídeo <span className="font-normal">opcional</span></span>
                <input
                  value={f.videoUrl}
                  onChange={(e) => setF({ ...f, videoUrl: e.target.value })}
                  placeholder="https://…"
                  className={inputCls}
                />
              </label>
            </div>

            <label className="block">
              <span className={rotulo}>Resumo <span className="font-normal">aparece no card</span></span>
              <input
                value={f.summary}
                onChange={(e) => setF({ ...f, summary: e.target.value })}
                placeholder="Uma linha sobre o que este processo resolve"
                className={inputCls}
              />
            </label>

            <label className="block">
              <span className={rotulo}>
                Conteúdo
                <span className="ml-2 font-normal text-muted/70">
                  {f.content.length.toLocaleString("pt-BR")} / {MAX_CONTEUDO.toLocaleString("pt-BR")}
                </span>
              </span>
              <textarea
                value={f.content}
                onChange={(e) => setF({ ...f, content: e.target.value })}
                rows={14}
                placeholder={"Escreva o passo a passo.\n\nPode usar markdown simples — ## títulos, - listas, **negrito**."}
                className={cn(inputCls, "resize-y font-mono text-[13px] leading-relaxed")}
              />
            </label>

            <div>
              <span className={rotulo}>Tags <span className="font-normal">ajudam a achar depois</span></span>
              <div className="flex flex-wrap items-center gap-1.5">
                {f.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs text-ink">
                    {t}
                    <button onClick={() => setF({ ...f, tags: f.tags.filter((x) => x !== t) })} className="text-muted hover:text-rose-500" aria-label={`Remover ${t}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                {f.tags.length < MAX_TAGS && (
                  <input
                    value={tagNova}
                    onChange={(e) => setTagNova(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
                    onBlur={addTag}
                    placeholder="+ tag"
                    className="w-24 rounded-full border border-dashed border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400"
                  />
                )}
              </div>
            </div>

            {erro && (
              <p className="flex items-center gap-1.5 text-xs text-rose-500">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {erro}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3.5">
          <span className="flex gap-2">
            {f.id && (
              <>
                <button
                  onClick={() => acao({ action: "toggle-pin", id: f.id, pinned: !f.pinned }).then((ok) => ok && setF({ ...f, pinned: !f.pinned }))}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-60"
                >
                  <Pin className={cn("h-3.5 w-3.5", f.pinned && "fill-amber-400 text-amber-500")} />
                  {f.pinned ? "Desafixar" : "Fixar no topo"}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Excluir "${f.title}"? Não dá para desfazer.`)) {
                      acao({ action: "delete-page", id: f.id }).then((ok) => ok && onClose());
                    }
                  }}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted hover:text-rose-500 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </button>
              </>
            )}
          </span>
          <span className="flex gap-2">
            <button onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={busy || f.title.trim().length < 3}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
