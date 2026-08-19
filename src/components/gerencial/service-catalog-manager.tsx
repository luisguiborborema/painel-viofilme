"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type Plan = { id: string; label: string; defaultPrice: number };
type Svc = { id: string; label: string; type: string; area: string; active: boolean; plans: Plan[] };

const AREAS = ["Social", "Performance", "Conteúdo", "Criação", "Audiovisual", "Desenvolvimento", "Outra"];
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: string) => { const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const inputCls = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400";

async function api(body: unknown): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/gerencial/service-catalog", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => null);
  return { ok: res.ok, error: j?.error };
}

export function ServiceCatalogManager() {
  const [services, setServices] = useState<Svc[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // nova linha de serviço
  const [nsLabel, setNsLabel] = useState("");
  const [nsType, setNsType] = useState<"recorrente" | "pontual">("recorrente");
  const [nsArea, setNsArea] = useState("Social");
  // novo plano por serviço
  const [planDraft, setPlanDraft] = useState<Record<string, { label: string; price: string }>>({});

  async function load() {
    const res = await fetch("/api/gerencial/service-catalog", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    setServices(res?.services ?? []);
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    load();
  }, []);

  async function addService() {
    if (!nsLabel.trim()) { toast("Informe o nome do serviço.", "error"); return; }
    setBusy("add-service");
    const r = await api({ action: "add-service", label: nsLabel.trim(), type: nsType, area: nsArea });
    setBusy(null);
    if (!r.ok) { toast(r.error ?? "Falha ao criar.", "error"); return; }
    setNsLabel("");
    toast("Serviço criado.", "success");
    load();
  }

  async function delService(id: string) {
    if (!window.confirm("Excluir este serviço e seus planos?")) return;
    setBusy(id);
    const r = await api({ action: "delete-service", id });
    setBusy(null);
    if (!r.ok) { toast(r.error ?? "Falha.", "error"); return; }
    load();
  }

  async function addPlan(serviceId: string) {
    const d = planDraft[serviceId];
    if (!d?.label.trim()) { toast("Informe o nome do plano/formato.", "error"); return; }
    setBusy(`plan-${serviceId}`);
    const r = await api({ action: "add-plan", serviceId, label: d.label.trim(), defaultPrice: num(d.price) });
    setBusy(null);
    if (!r.ok) { toast(r.error ?? "Falha.", "error"); return; }
    setPlanDraft((p) => ({ ...p, [serviceId]: { label: "", price: "" } }));
    load();
  }

  async function delPlan(id: string) {
    setBusy(id);
    const r = await api({ action: "delete-plan", id });
    setBusy(null);
    if (!r.ok) { toast(r.error ?? "Falha.", "error"); return; }
    load();
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>;

  const recorrentes = services.filter((s) => s.type === "recorrente");
  const pontuais = services.filter((s) => s.type === "pontual");

  const renderService = (s: Svc) => {
    const d = planDraft[s.id] ?? { label: "", price: "" };
    return (
      <Card key={s.id} className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-ink">{s.label}</p>
            <p className="text-[11px] uppercase tracking-wide text-brand-600">{s.area}</p>
          </div>
          <button onClick={() => delService(s.id)} disabled={busy === s.id} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50">
            {busy === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="mt-2 space-y-1">
          {s.plans.length === 0 && <p className="text-xs text-muted">Nenhum plano/formato ainda.</p>}
          {s.plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-subtle px-2.5 py-1.5 text-sm">
              <span className="text-ink">{p.label}</span>
              <span className="flex items-center gap-2">
                <span className="text-xs text-muted">{p.defaultPrice > 0 ? money(p.defaultPrice) : "sem preço"}</span>
                <button onClick={() => delPlan(p.id)} disabled={busy === p.id} className="text-muted hover:text-rose-500 disabled:opacity-50">
                  {busy === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                </button>
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <input value={d.label} onChange={(e) => setPlanDraft((p) => ({ ...p, [s.id]: { ...d, label: e.target.value } }))} placeholder={s.type === "recorrente" ? "Novo plano" : "Novo formato"} className={inputCls + " flex-1"} />
          <input value={d.price} onChange={(e) => setPlanDraft((p) => ({ ...p, [s.id]: { ...d, price: e.target.value } }))} inputMode="decimal" placeholder="Preço sugerido" className={inputCls + " w-28"} />
          <button onClick={() => addPlan(s.id)} disabled={busy === `plan-${s.id}`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-brand-600 px-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy === `plan-${s.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-5">
      {/* Novo serviço */}
      <Card className="p-4">
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">Novo serviço</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <input value={nsLabel} onChange={(e) => setNsLabel(e.target.value)} placeholder="Nome do serviço" className={inputCls + " sm:col-span-2"} />
          <select value={nsType} onChange={(e) => setNsType(e.target.value as "recorrente" | "pontual")} className={inputCls}>
            <option value="recorrente">Recorrente</option>
            <option value="pontual">Pontual</option>
          </select>
          <select value={nsArea} onChange={(e) => setNsArea(e.target.value)} className={inputCls}>
            {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="mt-2 flex justify-end">
          <button onClick={addService} disabled={busy === "add-service"} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy === "add-service" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Criar serviço
          </button>
        </div>
      </Card>

      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Repeat className="h-3.5 w-3.5" /> Recorrentes · VioDelivery</p>
        {recorrentes.length === 0 ? (
          <p className={cn("rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted")}>Nenhum serviço recorrente.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{recorrentes.map(renderService)}</div>
        )}
      </div>

      <div>
        <p className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Zap className="h-3.5 w-3.5" /> Pontuais · VioProjects</p>
        {pontuais.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">Nenhum serviço pontual.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">{pontuais.map(renderService)}</div>
        )}
      </div>
    </div>
  );
}
