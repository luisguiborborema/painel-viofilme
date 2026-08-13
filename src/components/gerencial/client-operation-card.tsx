"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RESPONSIBLE_ROLES, type ResponsibleRole } from "@/lib/data/operacao";
import { cn } from "@/lib/utils";

const FORMATS = ["Reels", "Feed", "Stories", "Carrossel"] as const;
const COMMON_SERVICES = ["Social", "Tráfego", "Design", "Copy", "UGC", "Site", "E-commerce"];
const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

export function ClientOperationCard({
  clientId,
  initialResponsibles,
  initialServices,
  initialDeliverables,
}: {
  clientId: string;
  initialResponsibles: Record<string, string>;
  initialServices: string[];
  initialDeliverables: Record<string, number>;
}) {
  const router = useRouter();
  const [team, setTeam] = useState<string[]>([]);
  const [resp, setResp] = useState<Record<string, string>>(() => ({ ...initialResponsibles }));
  const [services, setServices] = useState<string[]>(() => [...initialServices]);
  const [newService, setNewService] = useState("");
  const [dels, setDels] = useState<Record<string, number>>(() => ({ ...initialDeliverables }));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/gerencial/team", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (Array.isArray(j?.team)) setTeam(j.team as string[]);
      })
      .catch(() => {});
  }, []);

  function addService(name: string) {
    const v = name.trim();
    if (!v || services.includes(v)) return;
    setServices((s) => [...s, v]);
    setNewService("");
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      await fetch("/api/gerencial/client-operation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, responsibles: resp, services }),
      });
      // Entregáveis: um upsert por formato (mantém a tabela client_deliverables).
      await Promise.all(
        FORMATS.map((f) =>
          fetch("/api/gerencial/client-deliverables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, format: f, monthlyQty: Number(dels[f] ?? 0) }),
          }),
        ),
      );
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 1800);
    } finally {
      setBusy(false);
    }
  }

  const teamOptions = (current: string) => [...new Set([...team, current].filter(Boolean))];

  return (
    <Card className="p-5">
      <h2 className="mb-3 text-sm font-semibold text-ink">Operação do cliente</h2>

      {/* Responsáveis por função */}
      <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Responsáveis</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {RESPONSIBLE_ROLES.map((r) => {
          const key = r.key as ResponsibleRole;
          return (
            <label key={key} className="text-[11px] text-muted">
              {r.label}
              <select
                value={resp[key] ?? ""}
                onChange={(e) => setResp((s) => ({ ...s, [key]: e.target.value }))}
                className={inputCls}
              >
                <option value="">—</option>
                {teamOptions(resp[key] ?? "").map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          );
        })}
      </div>

      {/* Serviços */}
      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wide text-muted">Serviços</p>
      {services.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {services.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-ink">
              {s}
              <button onClick={() => setServices((arr) => arr.filter((x) => x !== s))} className="text-muted hover:text-rose-500" aria-label={`Remover ${s}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={newService}
          onChange={(e) => setNewService(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService(newService))}
          placeholder="Adicionar serviço"
          className="w-40 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400"
        />
        {COMMON_SERVICES.filter((s) => !services.includes(s)).map((s) => (
          <button key={s} onClick={() => addService(s)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink">
            <Plus className="h-3 w-3" /> {s}
          </button>
        ))}
      </div>

      {/* Entregáveis do mês */}
      <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wide text-muted">Entregáveis do mês</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FORMATS.map((f) => (
          <label key={f} className="text-[11px] text-muted">
            {f}
            <input
              type="number"
              min={0}
              max={99}
              value={dels[f] ?? 0}
              onChange={(e) => setDels((d) => ({ ...d, [f]: Math.max(0, Number(e.target.value) || 0) }))}
              className={inputCls}
            />
          </label>
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <button
          onClick={save}
          disabled={busy}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60",
            saved ? "bg-emerald-600" : "bg-brand-600 hover:bg-brand-700",
          )}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
          {saved ? "Salvo" : "Salvar operação"}
        </button>
      </div>
    </Card>
  );
}
