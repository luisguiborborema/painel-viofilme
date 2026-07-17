"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CLIENT_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "lead_gen", label: "Geração de leads", hint: "CPL / conversões" },
  { value: "ecommerce", label: "E-commerce", hint: "Pedidos / ROAS" },
  { value: "local_business", label: "Negócio local", hint: "Alcance / visitas" },
];

type Form = {
  name: string;
  segment: string;
  city: string;
  clientType: string;
  monthlyFee: string;
  whatsapp: string;
  hasPaidTraffic: boolean;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  csResponsavel: string;
};

const EMPTY: Form = {
  name: "",
  segment: "",
  city: "",
  clientType: "local_business",
  monthlyFee: "",
  whatsapp: "",
  hasPaidTraffic: false,
  contactName: "",
  contactPhone: "",
  contactEmail: "",
  csResponsavel: "",
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
      />
    </label>
  );
}

export function NewClientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (p: Partial<Form>) => setF((prev) => ({ ...prev, ...p }));

  async function submit() {
    if (!f.name.trim()) {
      setError("Nome é obrigatório.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gerencial/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...f,
          monthlyFee: f.monthlyFee ? Number(f.monthlyFee) : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Falha ao criar cliente.");
        return;
      }
      setOpen(false);
      setF(EMPTY);
      if (data.id && data.id !== "demo") {
        router.push(`/gerencial/clientes/${data.id}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("Falha de rede ao criar cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
      >
        <Plus className="h-4 w-4" /> Novo cliente
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8">
          <div className="w-full max-w-lg rounded-2xl border border-line bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-ink">Novo cliente</h2>
                <p className="text-xs text-muted">
                  O básico para começar — briefing completo e responsáveis você
                  ajusta na ficha depois.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted hover:bg-subtle hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <Field label="Nome do cliente *" value={f.name} onChange={(v) => set({ name: v })} placeholder="Ex.: Restaurante Sabor do Mar" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Segmento" value={f.segment} onChange={(v) => set({ segment: v })} placeholder="Gastronomia" />
                <Field label="Cidade" value={f.city} onChange={(v) => set({ city: v })} placeholder="Vitória, ES" />
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-muted">Tipo de negócio</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {CLIENT_TYPES.map((t) => (
                    <button
                      key={t.value}
                      onClick={() => set({ clientType: t.value })}
                      className={cn(
                        "rounded-xl border p-2.5 text-left transition-colors",
                        f.clientType === t.value
                          ? "border-brand-400 bg-brand-500/10"
                          : "border-line bg-subtle hover:border-brand-300",
                      )}
                    >
                      <p className="text-xs font-medium text-ink">{t.label}</p>
                      <p className="text-[10px] text-muted">{t.hint}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Fee mensal (R$)" value={f.monthlyFee} onChange={(v) => set({ monthlyFee: v.replace(/[^\d.]/g, "") })} placeholder="2800" type="text" />
                <Field label="WhatsApp" value={f.whatsapp} onChange={(v) => set({ whatsapp: v })} placeholder="5527999998888" />
              </div>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-subtle px-3 py-2.5">
                <span className="text-sm font-medium text-ink">Tem tráfego pago?</span>
                <button
                  role="switch"
                  aria-checked={f.hasPaidTraffic}
                  onClick={() => set({ hasPaidTraffic: !f.hasPaidTraffic })}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", f.hasPaidTraffic ? "bg-brand-500" : "bg-subtle-strong")}
                >
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform", f.hasPaidTraffic ? "translate-x-[22px]" : "translate-x-0.5")} />
                </button>
              </label>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Contato (nome)" value={f.contactName} onChange={(v) => set({ contactName: v })} placeholder="Pedro Costa" />
                <Field label="CS responsável" value={f.csResponsavel} onChange={(v) => set({ csResponsavel: v })} placeholder="Ana Lima" />
                <Field label="Telefone do contato" value={f.contactPhone} onChange={(v) => set({ contactPhone: v })} placeholder="(27) 99123-4567" />
                <Field label="E-mail do contato" value={f.contactEmail} onChange={(v) => set({ contactEmail: v })} placeholder="contato@cliente.com.br" type="email" />
              </div>

              {error && <p className="text-xs font-medium text-rose-500">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
                Cancelar
              </button>
              <button
                onClick={submit}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                <Plus className="h-4 w-4" />
                {saving ? "Criando…" : "Criar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
