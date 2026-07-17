"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, FolderOpen, MessageCircle } from "lucide-react";

/**
 * Ações Rápidas — Grupo 1 (head do cliente). Sem RBAC: só ações universais.
 * "Drive/Pasta de ativos" é casca (placeholder) até a integração ligar.
 */
export function ClientQuickActions({
  clientId,
  whatsapp,
}: {
  clientId: string;
  whatsapp?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const wa = whatsapp?.replace(/\D/g, "");

  const base =
    "inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-subtle";

  function copyLink() {
    void navigator.clipboard
      ?.writeText(`${window.location.origin}/gerencial/clientes/${clientId}`)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href="/cliente"
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Abrir portal do cliente
      </a>
      <button onClick={copyLink} className={base}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Link copiado" : "Copiar link"}
      </button>
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className={base}
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
      )}
      <button
        onClick={() => undefined}
        title="Integração de Drive será ligada em breve"
        className={`${base} cursor-default opacity-60`}
      >
        <FolderOpen className="h-3.5 w-3.5" /> Drive de ativos
      </button>
    </div>
  );
}
