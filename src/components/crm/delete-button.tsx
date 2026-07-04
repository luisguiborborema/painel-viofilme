"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";

/**
 * Botão de exclusão reutilizável (2 passos). Faz POST { action: "delete", id }
 * no endpoint e redireciona. Usado nas fichas de Empresa e Contato.
 */
export function DeleteButton({
  endpoint,
  id,
  redirectTo,
  confirmLabel,
}: {
  endpoint: string;
  id: string;
  redirectTo: string;
  confirmLabel: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    }).catch(() => {});
    router.push(redirectTo);
    router.refresh();
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-muted hover:bg-rose-500/10 hover:text-rose-500"
        title="Excluir"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-2 py-1.5">
      <span className="text-xs text-rose-600">{confirmLabel}</span>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Excluir"}
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-subtle"
      >
        Cancelar
      </button>
    </div>
  );
}
