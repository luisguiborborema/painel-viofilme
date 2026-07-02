"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { usePersistentState } from "@/lib/use-persistent-state";

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaProvider() {
  const [deferred, setDeferred] = useState<InstallEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed, hydrated] = usePersistentState(
    "vio-pwa-dismissed",
    false,
  );

  // Registro do service worker (apenas em produção).
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        // iOS Safari
        (window.navigator as unknown as { standalone?: boolean }).standalone ===
          true,
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as InstallEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setDismissed(true);
  }

  // Não mostrar: já instalado, dispensado, ou ainda hidratando.
  if (!hydrated || standalone || dismissed) return null;

  const canInstall = Boolean(deferred);
  // No iOS não existe prompt automático — mostramos instruções.
  if (!canInstall && !isIOS) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 mx-auto max-w-sm rounded-2xl border border-line bg-surface p-4 shadow-2xl sm:inset-x-auto sm:left-5">
      <button
        onClick={() => setDismissed(true)}
        className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:text-ink"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-bold text-white">
          V
        </span>
        <div className="pr-4">
          <p className="text-sm font-semibold text-ink">Instalar o Painel Viofilme</p>
          {canInstall ? (
            <>
              <p className="mt-0.5 text-xs text-muted">
                Adicione à tela inicial para abrir como um app, em tela cheia.
              </p>
              <button
                onClick={install}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                <Download className="h-3.5 w-3.5" /> Instalar app
              </button>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted">
              No iPhone/iPad: toque em{" "}
              <Share className="inline h-3.5 w-3.5 align-text-bottom" /> e depois
              em <strong>“Adicionar à Tela de Início”</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
