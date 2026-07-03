"use client";

import { useMemo, useState } from "react";
import { Briefcase, Building2, Check, Loader2, Plus, UserPlus, X } from "lucide-react";
import {
  DEFAULT_PIPELINE,
  type Company,
  type Contact,
  type CrmLead,
  type Stage,
} from "@/lib/data/crm";

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
  companies = [],
  contacts = [],
  stages = DEFAULT_PIPELINE.stages,
  defaultOwner = "",
}: {
  onClose: () => void;
  onCreated: (lead: CrmLead) => void;
  companies?: Company[];
  contacts?: Contact[];
  stages?: Stage[];
  defaultOwner?: string;
}) {
  const openStages = stages.filter((s) => s.kind === "open");

  // ── Empresa ────────────────────────────────────────────────────────────────
  const [companyInput, setCompanyInput] = useState("");
  const [company, setCompany] = useState<Company | null>(null);
  const [showCompanyList, setShowCompanyList] = useState(false);

  const companyMatches = useMemo(() => {
    const term = companyInput.trim().toLowerCase();
    if (!term) return companies.slice(0, 6);
    return companies.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 6);
  }, [companyInput, companies]);

  const exactMatch = companies.find(
    (c) => c.name.toLowerCase() === companyInput.trim().toLowerCase(),
  );

  // ── Contato ──────────────────────────────────────────────────────────────
  const [contactMode, setContactMode] = useState<"existing" | "new">("new");
  const [contactId, setContactId] = useState("");
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "" });

  const companyContacts = company
    ? contacts.filter((ct) => ct.companyId === company.id)
    : [];

  // ── Negócio ─────────────────────────────────────────────────────────────
  const [d, setD] = useState({
    name: "",
    monthlyValue: "",
    mediaBudget: "",
    plan: "",
    source: "",
    owner: defaultOwner,
    probability: "",
    stage: (openStages[0]?.key ?? "prospeccao") as string,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setDeal<K extends keyof typeof d>(k: K, v: (typeof d)[K]) {
    setD((prev) => ({ ...prev, [k]: v }));
  }

  function selectCompany(c: Company) {
    setCompany(c);
    setCompanyInput(c.name);
    setShowCompanyList(false);
    setContactMode("existing");
    setContactId("");
    if (!d.name.trim()) setDeal("name", `${c.name} — novo negócio`);
  }

  function clearCompany() {
    setCompany(null);
    setContactMode("new");
    setContactId("");
  }

  const companyName = company?.name ?? companyInput.trim();
  const canSubmit = Boolean(companyName) && Boolean(d.name.trim()) && !busy;

  async function submit() {
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    const nowIso = new Date().toISOString();
    const stageObj = openStages.find((s) => s.key === d.stage);

    const payload: Record<string, unknown> = {
      action: "create",
      name: d.name.trim(),
      monthlyValue: Number(d.monthlyValue) || 0,
      mediaBudget: Number(d.mediaBudget) || 0,
      plan: d.plan.trim() || undefined,
      source: d.source.trim() || undefined,
      owner: d.owner.trim() || undefined,
      probability: Number(d.probability) || stageObj?.probability || 0,
      stage: d.stage,
      stageId: stageObj?.id,
      // empresa
      ...(company
        ? { companyId: company.id }
        : { newCompany: { name: companyName, segment: undefined } }),
      // contato
      ...(contactMode === "existing" && contactId
        ? { contactId }
        : newContact.name.trim()
          ? {
              newContact: {
                name: newContact.name.trim(),
                phone: newContact.phone.replace(/\D/g, "") || undefined,
                email: newContact.email.trim() || undefined,
              },
            }
          : {}),
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
        name: d.name.trim(),
        contactName:
          contactMode === "existing"
            ? companyContacts.find((c) => c.id === contactId)?.name
            : newContact.name.trim() || undefined,
        segment: company?.segment,
        stage: d.stage,
        monthlyValue: Number(d.monthlyValue) || 0,
        mediaBudget: Number(d.mediaBudget) || 0,
        plan: d.plan.trim() || undefined,
        probability: Number(d.probability) || stageObj?.probability || 0,
        source: d.source.trim() || undefined,
        owner: d.owner.trim() || undefined,
        bant: {},
        companyId: json.companyId ?? company?.id,
        primaryContactId: json.contactId,
        tags: [],
        properties: {},
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
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Novo negócio</h2>
              <p className="text-xs text-muted">
                Vincule a uma empresa e um contato — como no HubSpot.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {/* Empresa */}
          <div>
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Building2 className="h-3.5 w-3.5" /> Empresa
            </p>
            {company ? (
              <div className="flex items-center justify-between rounded-lg border border-brand-400/50 bg-brand-50/40 px-3 py-2">
                <span className="text-sm font-medium text-ink">{company.name}</span>
                <button
                  onClick={clearCompany}
                  className="text-xs font-medium text-muted hover:text-ink"
                >
                  trocar
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  autoFocus
                  value={companyInput}
                  onChange={(e) => {
                    setCompanyInput(e.target.value);
                    setShowCompanyList(true);
                  }}
                  onFocus={() => setShowCompanyList(true)}
                  placeholder="Buscar empresa ou digitar uma nova…"
                  className={inputCls}
                />
                {showCompanyList && (companyMatches.length > 0 || companyInput.trim()) && (
                  <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-line bg-surface p-1 shadow-lg">
                    {companyMatches.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => selectCompany(c)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-subtle"
                      >
                        <Building2 className="h-4 w-4 text-muted" />
                        <span className="flex-1 truncate">{c.name}</span>
                        {c.segment && (
                          <span className="text-xs text-muted">{c.segment}</span>
                        )}
                      </button>
                    ))}
                    {companyInput.trim() && !exactMatch && (
                      <button
                        onClick={() => setShowCompanyList(false)}
                        className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-brand-600 hover:bg-brand-50"
                      >
                        <Plus className="h-4 w-4" />
                        Criar empresa “{companyInput.trim()}”
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contato */}
          <div>
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <UserPlus className="h-3.5 w-3.5" /> Contato
            </p>
            {companyContacts.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {companyContacts.map((ct) => (
                  <button
                    key={ct.id}
                    onClick={() => {
                      setContactMode("existing");
                      setContactId(ct.id);
                    }}
                    className={
                      "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium " +
                      (contactMode === "existing" && contactId === ct.id
                        ? "bg-brand-600 text-white"
                        : "bg-subtle text-muted hover:bg-subtle-strong")
                    }
                  >
                    {contactMode === "existing" && contactId === ct.id && (
                      <Check className="h-3 w-3" />
                    )}
                    {ct.name}
                  </button>
                ))}
                <button
                  onClick={() => {
                    setContactMode("new");
                    setContactId("");
                  }}
                  className={
                    "inline-flex items-center gap-1 rounded-full border border-dashed border-line px-2.5 py-1 text-xs font-medium " +
                    (contactMode === "new" ? "bg-brand-50 text-brand-600" : "text-muted hover:bg-subtle")
                  }
                >
                  <Plus className="h-3 w-3" /> Novo
                </button>
              </div>
            )}
            {contactMode === "new" && (
              <div className="grid grid-cols-2 gap-2">
                <input
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="Nome do contato"
                  className={inputCls + " col-span-2"}
                />
                <input
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  placeholder="WhatsApp (5527999998888)"
                  inputMode="tel"
                  className={inputCls}
                />
                <input
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  placeholder="E-mail"
                  className={inputCls}
                />
              </div>
            )}
          </div>

          {/* Negócio */}
          <div>
            <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <Briefcase className="h-3.5 w-3.5" /> Negócio
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Título do negócio *" full>
                <input
                  value={d.name}
                  onChange={(e) => setDeal("name", e.target.value)}
                  placeholder="Ex.: Social Pro + Tráfego (mensal)"
                  className={inputCls}
                />
              </Field>
              <Field label="Valor mensal (R$)">
                <input
                  value={d.monthlyValue}
                  onChange={(e) => setDeal("monthlyValue", e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className={inputCls}
                />
              </Field>
              <Field label="Budget de mídia (R$)">
                <input
                  value={d.mediaBudget}
                  onChange={(e) => setDeal("mediaBudget", e.target.value.replace(/[^\d.]/g, ""))}
                  inputMode="decimal"
                  className={inputCls}
                />
              </Field>
              <Field label="Plano">
                <input value={d.plan} onChange={(e) => setDeal("plan", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Origem">
                <input value={d.source} onChange={(e) => setDeal("source", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Responsável">
                <input value={d.owner} onChange={(e) => setDeal("owner", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Estágio inicial">
                <select
                  value={d.stage}
                  onChange={(e) => setDeal("stage", e.target.value)}
                  className={inputCls}
                >
                  {openStages.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}
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
            disabled={!canSubmit}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
            Criar negócio
          </button>
        </div>
      </div>
    </div>
  );
}
