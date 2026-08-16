"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil, X } from "lucide-react";

/**
 * Edição inline dos slides antes de exportar: liga contentEditable em todo
 * elemento [data-edit-key], coleta os textos e salva como overrides no deck.
 */
export function DeckEditToolbar({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggle(on: boolean) {
    document.querySelectorAll<HTMLElement>("[data-edit-key]").forEach((el) => {
      el.contentEditable = on ? "true" : "false";
      el.spellcheck = false;
      el.style.outline = on ? "1px dashed rgba(47,111,240,.7)" : "";
      el.style.outlineOffset = on ? "2px" : "";
      el.style.cursor = on ? "text" : "";
      el.style.borderRadius = on ? "3px" : "";
    });
  }

  function start() {
    setEditing(true);
    toggle(true);
  }

  function cancel() {
    toggle(false);
    setEditing(false);
    window.location.reload(); // descarta edições não salvas
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    const overrides: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>("[data-edit-key]").forEach((el) => {
      const k = el.getAttribute("data-edit-key");
      if (k) overrides[k] = (el.innerText || "").replace(/\n{3,}/g, "\n\n").trim();
    });
    try {
      const res = await fetch("/api/gerencial/client-deck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, overrides }),
      });
      if (!res.ok) throw new Error();
      toggle(false);
      setEditing(false);
      router.refresh();
    } catch {
      // mantém em edição para não perder o texto
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        onClick={start}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <Pencil className="h-4 w-4" /> Editar slides
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={cancel}
        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        <X className="h-4 w-4" /> Cancelar
      </button>
      <button
        onClick={save}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar edições
      </button>
    </div>
  );
}
