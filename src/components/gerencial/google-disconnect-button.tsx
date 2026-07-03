"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Unplug } from "lucide-react";

export function GoogleDisconnectButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function disconnect() {
    setBusy(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-rose-600 hover:bg-rose-50"
      >
        <Unplug className="h-4 w-4" /> Desconectar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted">Confirmar?</span>
      <button
        onClick={disconnect}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        Desconectar
      </button>
      <button
        onClick={() => setConfirming(false)}
        className="rounded-lg px-2 py-1.5 text-xs text-muted hover:bg-subtle"
      >
        Cancelar
      </button>
    </div>
  );
}
