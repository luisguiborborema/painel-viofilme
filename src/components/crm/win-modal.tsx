"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Sparkles, Trophy, X } from "lucide-react";
import type { CrmLead } from "@/lib/data/crm";

const AUTOMATIONS = [
  { module: "M3 Operação", label: "Criar projeto no módulo Operação" },
  { module: "M4 Financeiro", label: "Gerar primeira fatura no Financeiro (via Asaas)" },
  { module: "M5 CS", label: "Criar ficha no módulo CS com histórico do lead" },
  { module: "Portal", label: "Gerar acesso ao Portal do Cliente" },
  { module: "Contrato", label: "Enviar contrato para assinatura digital" },
];

export function WinModal({
  lead,
  onClose,
  onConfirmed,
}: {
  lead: CrmLead;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const [plan, setPlan] = useState(lead.plan ?? "Social Pro");
  const [monthlyValue, setMonthlyValue] = useState(String(lead.monthlyValue || ""));
  const [mediaBudget, setMediaBudget] = useState(String(lead.mediaBudget || ""));
  const [startDate, setStartDate] = useState("");
  const [owner, setOwner] = useState(lead.owner ?? "");
  const [source, setSource] = useState(lead.source ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/crm/win", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: lead.id,
          startDate,
          monthlyValue: Number(monthlyValue) || 0,
          mediaBudget: Number(mediaBudget) || 0,
          plan,
          owner,
          source,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      onConfirmed();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
              <Trophy className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">
                Confirmar fechamento — {lead.name}
              </h2>
              <p className="text-xs text-muted">
                Preencha os dados finais para iniciar o onboarding automático.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Dados do contrato
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Plano contratado">
              <input
                value={plan}
                onChange={(e) => setPlan(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Valor mensal (R$)">
              <input
                value={monthlyValue}
                onChange={(e) => setMonthlyValue(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                className={inputCls}
              />
            </Field>
            <Field label="Data de início">
              <input
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="01/07/2025"
                className={inputCls}
              />
            </Field>
            <Field label="CS responsável">
              <input value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Budget de mídia (R$/mês)">
              <input
                value={mediaBudget}
                onChange={(e) => setMediaBudget(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                className={inputCls}
              />
            </Field>
            <Field label="Origem do lead">
              <input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} />
            </Field>
          </div>

          {/* Automações */}
          <div className="rounded-xl border border-line bg-canvas p-3">
            <div className="mb-2 flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <p className="text-xs font-semibold text-ink">
                Ao confirmar, o sistema executa automaticamente:
              </p>
            </div>
            <ul className="space-y-1.5">
              {AUTOMATIONS.map((a) => (
                <li key={a.module} className="flex items-center gap-2 text-xs text-muted">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                  <span className="flex-1 text-ink">{a.label}</span>
                  <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                    {a.module}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            ⚠ Esta ação é irreversível no funil. Confira valor e data de início antes de
            confirmar; ajustes posteriores exigem edição manual nos módulos.
          </p>

          {error && <p className="text-xs text-rose-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={confirm}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
            Confirmar e iniciar onboarding
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}
