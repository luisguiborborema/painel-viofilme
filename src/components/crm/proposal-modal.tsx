"use client";

import { useState } from "react";
import { Download, FileText, Loader2, Send, X } from "lucide-react";

const DEFAULT_SCOPE = [
  "Gestão de tráfego pago (Meta e Google Ads)",
  "Social media: linha editorial + posts e stories no mês",
  "Relatório mensal de performance",
  "Reunião quinzenal de acompanhamento",
].join("\n");

export function ProposalModal({
  dealId,
  contactName,
  hasPhone,
  onClose,
}: {
  dealId: string;
  contactName?: string;
  hasPhone: boolean;
  onClose: () => void;
}) {
  const [scope, setScope] = useState(DEFAULT_SCOPE);
  const [validity, setValidity] = useState(15);
  const [busy, setBusy] = useState<null | "download" | "send">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function download() {
    setBusy("download");
    setMsg(null);
    try {
      const res = await fetch("/api/crm/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "download", dealId, scope, validityDays: validity }),
      });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch {
      setMsg("Não foi possível gerar o PDF.");
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    setMsg(null);
    try {
      const res = await fetch("/api/crm/proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", dealId, scope, validityDays: validity }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      setMsg(json.sent ? "Proposta enviada por WhatsApp! ✅" : "PDF gerado, mas o envio falhou.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Proposta comercial</h2>
              <p className="text-xs text-muted">PDF com a marca Viofilme, a partir deste negócio.</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3 p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Escopo (uma linha por item)</span>
            <textarea
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              rows={6}
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Validade
            <input
              type="number"
              min={0}
              value={validity}
              onChange={(e) => setValidity(Number(e.target.value))}
              className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink outline-none focus:border-brand-400"
            />
            dias
          </label>
          <p className="text-[11px] text-muted">
            Valor e plano vêm do próprio negócio. Ajuste-os na ficha se precisar.
          </p>
          {msg && <p className="text-xs text-ink">{msg}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-4">
          <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
            Fechar
          </button>
          <button
            onClick={download}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-subtle disabled:opacity-60"
          >
            {busy === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Baixar PDF
          </button>
          <button
            onClick={send}
            disabled={busy !== null || !hasPhone}
            title={hasPhone ? "" : "Contato sem WhatsApp"}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar {contactName ? `a ${contactName.split(" ")[0]}` : "por WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  );
}
