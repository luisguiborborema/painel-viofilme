"use client";

import { useState } from "react";
import { Loader2, UserPlus, X } from "lucide-react";
import { CRM_STAGES, type CrmLead, type CrmStage } from "@/lib/data/crm";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={full ? "col-span-2 block" : "block"}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

export function NewLeadModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (lead: CrmLead) => void;
}) {
  const [f, setF] = useState({
    name: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    segment: "",
    monthlyValue: "",
    mediaBudget: "",
    plan: "",
    source: "",
    owner: "",
    probability: "",
    stage: "prospeccao" as CrmStage,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof f>(k: K, v: (typeof f)[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function submit() {
    if (!f.name.trim() || busy) return;
    setBusy(true);
    setError(null);
    const nowIso = new Date().toISOString();
    const payload = {
      action: "create" as const,
      name: f.name.trim(),
      contactName: f.contactName.trim() || undefined,
      contactPhone: f.contactPhone.replace(/\D/g, "") || undefined,
      contactEmail: f.contactEmail.trim() || undefined,
      segment: f.segment.trim() || undefined,
      monthlyValue: Number(f.monthlyValue) || 0,
      mediaBudget: Number(f.mediaBudget) || 0,
      plan: f.plan.trim() || undefined,
      source: f.source.trim() || undefined,
      owner: f.owner.trim() || undefined,
      probability: Number(f.probability) || 0,
      stage: f.stage,
    };
    try {
      const res = await fetch("/api/crm/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "falha");
      onCreated({
        id: json.id ?? `tmp-${Date.now()}`,
        name: payload.name,
        contactName: payload.contactName,
        contactPhone: payload.contactPhone,
        contactEmail: payload.contactEmail,
        segment: payload.segment,
        stage: payload.stage,
        monthlyValue: payload.monthlyValue,
        mediaBudget: payload.mediaBudget,
        plan: payload.plan,
        probability: payload.probability,
        source: payload.source,
        owner: payload.owner,
        bant: {},
        stageChangedAt: nowIso,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
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
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Novo lead</h2>
              <p className="text-xs text-muted">
                Cadastre uma oportunidade no funil comercial.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 p-5">
          <Field label="Empresa / lead *" full>
            <input
              autoFocus
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Ex.: Imobiliária Costa Mar"
              className={inputCls}
            />
          </Field>
          <Field label="Contato">
            <input value={f.contactName} onChange={(e) => set("contactName", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Segmento">
            <input value={f.segment} onChange={(e) => set("segment", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Telefone (WhatsApp)">
            <input
              value={f.contactPhone}
              onChange={(e) => set("contactPhone", e.target.value)}
              placeholder="5527999998888"
              inputMode="tel"
              className={inputCls}
            />
          </Field>
          <Field label="E-mail">
            <input value={f.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Valor mensal (R$)">
            <input
              value={f.monthlyValue}
              onChange={(e) => set("monthlyValue", e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field label="Budget de mídia (R$)">
            <input
              value={f.mediaBudget}
              onChange={(e) => set("mediaBudget", e.target.value.replace(/[^\d.]/g, ""))}
              inputMode="decimal"
              className={inputCls}
            />
          </Field>
          <Field label="Plano">
            <input value={f.plan} onChange={(e) => set("plan", e.target.value)} placeholder="Social Pro + Tráfego" className={inputCls} />
          </Field>
          <Field label="Origem do lead">
            <input value={f.source} onChange={(e) => set("source", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Responsável">
            <input value={f.owner} onChange={(e) => set("owner", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Probabilidade (%)">
            <input
              value={f.probability}
              onChange={(e) => set("probability", e.target.value.replace(/\D/g, "").slice(0, 3))}
              inputMode="numeric"
              className={inputCls}
            />
          </Field>
          <Field label="Estágio inicial" full>
            <select
              value={f.stage}
              onChange={(e) => set("stage", e.target.value as CrmStage)}
              className={inputCls}
            >
              {CRM_STAGES.filter((s) => s.open).map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </Field>

          {error && <p className="col-span-2 text-xs text-rose-500">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-line p-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={busy || !f.name.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Criar lead
          </button>
        </div>
      </div>
    </div>
  );
}
