"use client";

import { useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";

export function WhatsappTest({ configured }: { configured: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/whatsapp/test", { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      setOk(true);
      setMsg(`Enviado para ${json.sent} número(s) da agência.`);
    } catch (e) {
      setOk(false);
      setMsg(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-300">
            <MessageCircle className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-medium text-ink">Notificações por WhatsApp</p>
            <p className="text-xs text-muted">
              Alertas internos da equipe via Uazapi.
            </p>
          </div>
        </div>
        {configured ? (
          <button
            onClick={run}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <MessageCircle className="h-4 w-4" />
            )}
            Testar WhatsApp
          </button>
        ) : (
          <span className="text-xs text-muted">Não configurado</span>
        )}
      </div>
      {msg && (
        <p
          className={
            "mt-2 text-xs " + (ok ? "text-emerald-400" : "text-rose-400")
          }
        >
          {msg}
        </p>
      )}
    </div>
  );
}
