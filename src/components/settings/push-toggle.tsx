"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "off" | "on" | "denied";

export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (
      !vapidPublicKey ||
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window)
    ) {
      setState("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setState(sub ? "on" : "off"))
      .catch(() => setState("off"));
  }, [vapidPublicKey]);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      const json = await res.json();
      setState("on");
      setMsg(
        json.persisted === false
          ? "Ativado neste dispositivo (envio real requer o banco configurado)."
          : "Notificações ativadas neste dispositivo.",
      );
    } catch {
      setMsg("Não foi possível ativar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("Notificações desativadas neste dispositivo.");
    } catch {
      setMsg("Não foi possível desativar. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/push/test", { method: "POST" });
      const json = await res.json();
      setMsg(
        res.ok
          ? `Notificação de teste enviada (${json.sent}).`
          : json.error || "Falha ao enviar teste.",
      );
    } catch {
      setMsg("Falha ao enviar teste.");
    } finally {
      setBusy(false);
    }
  }

  const on = state === "on";

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              on ? "bg-brand-500/15 text-brand-300" : "bg-subtle text-muted",
            )}
          >
            {on ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
          </span>
          <div>
            <p className="text-sm font-medium text-ink">
              Notificações push
            </p>
            <p className="text-xs text-muted">
              Avisos de aprovações, reuniões e resultados neste dispositivo.
            </p>
          </div>
        </div>

        {state === "loading" ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted" />
        ) : state === "unsupported" ? (
          <span className="text-xs text-muted">Indisponível</span>
        ) : state === "denied" ? (
          <span className="text-xs text-amber-400">Bloqueado no navegador</span>
        ) : (
          <button
            role="switch"
            aria-checked={on}
            disabled={busy}
            onClick={on ? disable : enable}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60",
              on ? "bg-brand-500" : "bg-subtle-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                on ? "translate-x-[22px]" : "translate-x-0.5",
              )}
            />
          </button>
        )}
      </div>

      {state === "denied" && (
        <p className="mt-3 text-xs text-muted">
          Você bloqueou as notificações para este site. Reative nas permissões
          do navegador (ícone de cadeado na barra de endereço).
        </p>
      )}

      {on && (
        <button
          onClick={test}
          disabled={busy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bell className="h-3.5 w-3.5" />}
          Enviar teste
        </button>
      )}

      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
