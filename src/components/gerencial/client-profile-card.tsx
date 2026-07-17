"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Contact } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ClientProfileInitial = {
  city: string;
  csResponsavel: string;
  contractModel: string;
  driveFolderUrl: string;
  contactName: string;
  contactRole: string;
  contactPhone: string;
  contactEmail: string;
  briefObjetivo: string;
  briefTom: string;
  briefPublico: string;
  briefConcorrentes: string;
  briefRestricoes: string;
};

// "—" (placeholder do servidor) volta como campo vazio para edição.
const und = (v: string) => (v === "—" ? "" : v);

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  textarea?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="w-full resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
        />
      )}
    </label>
  );
}

export function ClientProfileCard({
  clientId,
  initial,
}: {
  clientId: string;
  initial: ClientProfileInitial;
}) {
  const router = useRouter();
  const [f, setF] = useState<ClientProfileInitial>({
    city: und(initial.city),
    csResponsavel: und(initial.csResponsavel),
    contractModel: initial.contractModel === "pontual" ? "pontual" : "recorrente",
    driveFolderUrl: und(initial.driveFolderUrl),
    contactName: und(initial.contactName),
    contactRole: und(initial.contactRole),
    contactPhone: und(initial.contactPhone),
    contactEmail: und(initial.contactEmail),
    briefObjetivo: und(initial.briefObjetivo),
    briefTom: und(initial.briefTom),
    briefPublico: und(initial.briefPublico),
    briefConcorrentes: und(initial.briefConcorrentes),
    briefRestricoes: und(initial.briefRestricoes),
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (p: Partial<ClientProfileInitial>) => {
    setF((prev) => ({ ...prev, ...p }));
    setSaved(false);
  };

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gerencial/client-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...f }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Falha ao salvar.");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Falha de rede ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Contact className="h-4 w-4 text-brand-300" />
        <h2 className="text-sm font-semibold text-ink">Contatos &amp; briefing</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Alimenta o cabeçalho do cliente, o card de briefing e o Hub. Deixe em
        branco o que ainda não tiver.
      </p>

      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Contato (nome)" value={f.contactName} onChange={(v) => set({ contactName: v })} placeholder="Ex.: Pedro Costa" />
          <Field label="Cargo" value={f.contactRole} onChange={(v) => set({ contactRole: v })} placeholder="Ex.: CEO" />
          <Field label="Telefone / WhatsApp" value={f.contactPhone} onChange={(v) => set({ contactPhone: v })} placeholder="(27) 99123-4567" />
          <Field label="E-mail" value={f.contactEmail} onChange={(v) => set({ contactEmail: v })} placeholder="contato@cliente.com.br" />
          <Field label="Cidade" value={f.city} onChange={(v) => set({ city: v })} placeholder="Vitória, ES" />
          <Field label="CS responsável" value={f.csResponsavel} onChange={(v) => set({ csResponsavel: v })} placeholder="Ex.: Ana Lima" />
        </div>

        <div>
          <span className="mb-1 block text-xs font-medium text-muted">Modelo de contrato</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: "recorrente", label: "VioDelivery", hint: "Recorrente" },
              { value: "pontual", label: "VioProjects", hint: "Pontual" },
            ].map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => set({ contractModel: t.value })}
                className={cn(
                  "rounded-xl border p-2.5 text-left transition-colors",
                  f.contractModel === t.value ? "border-brand-400 bg-brand-500/10" : "border-line bg-subtle hover:border-brand-300",
                )}
              >
                <p className="text-xs font-medium text-ink">{t.label}</p>
                <p className="text-[10px] text-muted">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        <Field
          label="Pasta de ativos (Drive)"
          value={f.driveFolderUrl}
          onChange={(v) => set({ driveFolderUrl: v })}
          placeholder="https://drive.google.com/drive/folders/…"
        />

        <div className="space-y-3 border-t border-line pt-4">
          <Field label="Objetivo" value={f.briefObjetivo} onChange={(v) => set({ briefObjetivo: v })} placeholder="O que o cliente quer alcançar" textarea />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Tom de voz" value={f.briefTom} onChange={(v) => set({ briefTom: v })} textarea />
            <Field label="Público" value={f.briefPublico} onChange={(v) => set({ briefPublico: v })} textarea />
            <Field label="Concorrentes" value={f.briefConcorrentes} onChange={(v) => set({ briefConcorrentes: v })} textarea />
            <Field label="Restrições" value={f.briefRestricoes} onChange={(v) => set({ briefRestricoes: v })} textarea />
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" />
          {saving ? "Salvando…" : "Salvar contatos & briefing"}
        </button>
        {error && <span className="text-xs font-medium text-rose-500">{error}</span>}
        {saved && !error && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Salvo
          </span>
        )}
      </div>
    </Card>
  );
}
