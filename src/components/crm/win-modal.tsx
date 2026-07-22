"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronLeft, Clock, Loader2, Sparkles, Trophy, X } from "lucide-react";
import { formatBRL, cn } from "@/lib/utils";
import type { CrmLead } from "@/lib/data/crm";

type Automation = { module: string; label: string; done: boolean };

const AUTOMATIONS: Automation[] = [
  { module: "M3 Operação", label: "Criar projeto no módulo Operação", done: false },
  { module: "M4 Financeiro", label: "Gerar primeira fatura no Financeiro (via Asaas)", done: false },
  { module: "M5 CS", label: "Criar ficha no módulo CS com histórico do lead", done: false },
  { module: "Portal", label: "Gerar acesso ao Portal do Cliente", done: false },
  { module: "Contrato", label: "Enviar contrato para assinatura digital", done: false },
];

const CONTRACT_TYPES = ["Mensal recorrente", "Trimestral", "Semestral", "Anual", "Projeto pontual"];

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

export function WinModal({
  lead,
  onClose,
  onConfirmed,
}: {
  lead: CrmLead;
  onClose: () => void;
  onConfirmed: () => void;
}) {
  const props = (lead.properties ?? {}) as Record<string, unknown>;
  const [phase, setPhase] = useState<"form" | "confirm" | "done">("form");
  const [plan, setPlan] = useState(lead.plan ?? "Social Pro");
  const [monthlyValue, setMonthlyValue] = useState(String(lead.monthlyValue || ""));
  const [mediaBudget, setMediaBudget] = useState(String(lead.mediaBudget || ""));
  const [startDate, setStartDate] = useState("");
  const [owner, setOwner] = useState(lead.owner ?? "");
  const [source, setSource] = useState(lead.source ?? "");
  const [contractType, setContractType] = useState(String(props.n_tipo_contrato ?? CONTRACT_TYPES[0]));
  const [contractUrl, setContractUrl] = useState(String(props.n_zapsign ?? ""));
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Automation[]>([]);

  const canReview = Number(monthlyValue) > 0 && startDate.trim().length > 0;

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
          contractType,
          contractUrl: contractUrl.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      setResult((json.automations as Automation[]) ?? AUTOMATIONS);
      setPhase("done");
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
                {phase === "done" ? "Onboarding iniciado" : "Fechar negócio"} — {lead.name}
              </h2>
              <p className="text-xs text-muted">
                {phase === "form" && "Preencha os dados finais do contrato."}
                {phase === "confirm" && "Revise: esta ação é irreversível no funil."}
                {phase === "done" && "O gatilho Lead Ganho disparou as automações."}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── PASSO 1: formulário ─────────────────────────── */}
        {phase === "form" && (
          <>
            <div className="space-y-4 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Dados do contrato</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Plano contratado">
                  <input value={plan} onChange={(e) => setPlan(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Tipo de contrato">
                  <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputCls}>
                    {CONTRACT_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Valor mensal (R$) *">
                  <input value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputCls} />
                </Field>
                <Field label="Budget de mídia (R$/mês)">
                  <input value={mediaBudget} onChange={(e) => setMediaBudget(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={inputCls} />
                </Field>
                <Field label="Data de início *">
                  <input value={startDate} onChange={(e) => setStartDate(e.target.value)} placeholder="01/07/2025" className={inputCls} />
                </Field>
                <Field label="CS responsável">
                  <input value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Origem do lead">
                  <input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} />
                </Field>
                <Field label="Link do contrato (ZapSign)">
                  <input value={contractUrl} onChange={(e) => setContractUrl(e.target.value)} placeholder="https://…" className={inputCls} />
                </Field>
              </div>

              <div className="rounded-xl border border-line bg-canvas p-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-brand-500" />
                  <p className="text-xs font-semibold text-ink">Ao confirmar, o sistema dispara:</p>
                </div>
                <ul className="space-y-1.5">
                  {AUTOMATIONS.map((a) => (
                    <li key={a.module} className="flex items-center gap-2 text-xs">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                      <span className="flex-1 text-ink">{a.label}</span>
                      <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">{a.module}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-line p-4">
              <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
                Cancelar
              </button>
              <button
                onClick={() => setPhase("confirm")}
                disabled={!canReview}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Revisar e confirmar
              </button>
            </div>
          </>
        )}

        {/* ── PASSO 2: revisão + irreversibilidade ────────── */}
        {phase === "confirm" && (
          <>
            <div className="space-y-4 p-5">
              <div className="rounded-xl border border-line bg-canvas p-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Confira antes de fechar</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <Summary label="Cliente" value={lead.name} />
                  <Summary label="Plano" value={plan} />
                  <Summary label="Tipo de contrato" value={contractType} />
                  <Summary label="Valor mensal" value={formatBRL(Number(monthlyValue) || 0)} />
                  <Summary label="Budget de mídia" value={formatBRL(Number(mediaBudget) || 0)} />
                  <Summary label="Início" value={startDate || "—"} />
                  <Summary label="CS responsável" value={owner || "—"} />
                  <Summary label="Contrato" value={contractUrl ? "Link anexado" : "—"} />
                </dl>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Esta ação é <strong>irreversível no funil</strong>: cria o cliente na Operação, gera fatura, ficha de CS,
                  acesso ao Portal e envia o contrato. Ajustes posteriores exigem edição manual nos módulos.
                </span>
              </div>

              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="h-4 w-4 rounded border-line accent-emerald-600" />
                Confirmo os dados e entendo que é irreversível.
              </label>

              {error && <p className="text-xs text-rose-500">{error}</p>}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-line p-4">
              <button onClick={() => setPhase("form")} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
                <ChevronLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                onClick={confirm}
                disabled={busy || !ack}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                Confirmar e iniciar onboarding
              </button>
            </div>
          </>
        )}

        {/* ── PASSO 3: resultado ──────────────────────────── */}
        {phase === "done" && (
          <>
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-5 w-5" /> {lead.name} agora é cliente!
              </div>
              <ul className="space-y-1.5">
                {result.map((a) => (
                  <li key={a.module} className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
                    {a.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    ) : (
                      <Clock className="h-4 w-4 shrink-0 text-amber-500" />
                    )}
                    <span className="flex-1 text-ink">{a.label}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-medium", a.done ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600")}>
                      {a.done ? "feito" : "pendente"}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-[11px] text-muted">
                As automações marcadas como pendentes ligam quando as integrações (Asaas, CS, Portal, ZapSign) forem ativadas.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-line p-4">
              <button
                onClick={onConfirmed}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
              >
                Concluir
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="font-medium text-ink">{value}</dd>
    </div>
  );
}
