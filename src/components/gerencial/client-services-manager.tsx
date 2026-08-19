"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Repeat, Trash2, Zap } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { useReadOnly } from "@/components/shell/read-only-context";
import { cn } from "@/lib/utils";

type Svc = { id: string; label: string; type: string; area: string; plans: { id: string; label: string; defaultPrice: number }[] };
type Squad = { id: string; name: string; area: string };
type Person = { id: string; name: string; squadId: string | null; canBePo: boolean };
type Line = {
  id: string; service_id: string | null; plan_id: string | null; service_label: string | null; plan_label: string | null; type: string;
  base_value: number; discount: number; final_value: number;
  squad_id: string | null; analyst_id: string | null; executor_id: string | null; po_id: string | null;
};

const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: string) => { const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const inputCls = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-50";

export function ClientServicesManager({ clientId }: { clientId: string }) {
  const readOnly = useReadOnly();
  const [services, setServices] = useState<Svc[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  // formulário de nova linha
  const [type, setType] = useState<"recorrente" | "pontual">("recorrente");
  const [serviceId, setServiceId] = useState("");
  const [planId, setPlanId] = useState("");
  const [base, setBase] = useState("");
  const [discount, setDiscount] = useState("");
  const [squadId, setSquadId] = useState("");
  const [executorId, setExecutorId] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/gerencial/clients", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch(`/api/gerencial/client-services?clientId=${clientId}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]).then(([cat, svc]) => {
      if (!alive) return;
      setServices(cat?.services ?? []);
      setSquads(cat?.squads ?? []);
      setPeople(cat?.people ?? []);
      setLines(svc?.lines ?? []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [clientId]);

  const svcById = (id: string | null) => (id ? services.find((s) => s.id === id) : undefined);
  const nameById = (id: string | null) => (id ? people.find((p) => p.id === id)?.name ?? squads.find((s) => s.id === id)?.name ?? "" : "");
  const options = services.filter((s) => s.type === type);
  const selectedSvc = svcById(serviceId);

  function onService(id: string) { setServiceId(id); setPlanId(""); setBase(""); setDiscount(""); }
  function onPlan(id: string) {
    setPlanId(id);
    const price = selectedSvc?.plans.find((pl) => pl.id === id)?.defaultPrice ?? 0;
    setBase(price ? String(price) : "");
  }

  const recorrentes = lines.filter((l) => l.type === "recorrente");
  const pontuais = lines.filter((l) => l.type === "pontual");
  const mrr = recorrentes.reduce((a, l) => a + Number(l.final_value ?? 0), 0);

  async function add() {
    if (!serviceId) { toast("Selecione o serviço.", "error"); return; }
    setBusy("add");
    try {
      const res = await fetch("/api/gerencial/client-services", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add", clientId, type, serviceId, planId: planId || undefined,
          serviceLabel: selectedSvc?.label,
          planLabel: selectedSvc?.plans.find((p) => p.id === planId)?.label,
          baseValue: num(base), discount: num(discount),
          squadId: type === "recorrente" ? squadId || undefined : undefined,
          executorId: type === "pontual" ? executorId || undefined : undefined,
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { toast(j?.error ?? "Não foi possível adicionar.", "error"); return; }
      if (j?.line) setLines((p) => [...p, j.line as Line]);
      setServiceId(""); setPlanId(""); setBase(""); setDiscount(""); setSquadId(""); setExecutorId("");
      toast("Serviço adicionado.", "success");
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Remover este serviço do cliente?")) return;
    setBusy(id);
    try {
      const res = await fetch("/api/gerencial/client-services", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id, clientId }),
      });
      if (!res.ok) { toast("Não foi possível remover.", "error"); return; }
      setLines((p) => p.filter((l) => l.id !== id));
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>;

  const renderLine = (l: Line) => {
    const svc = svcById(l.service_id);
    const planCat = svc?.plans.find((pl) => pl.id === l.plan_id);
    const svcName = l.service_label || svc?.label || "Serviço";
    const planName = l.plan_label || planCat?.label || "";
    const owner = nameById(l.squad_id) || nameById(l.executor_id);
    return (
      <li key={l.id} className="flex items-center gap-3 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-ink">{svcName}{planName ? ` · ${planName}` : ""}</p>
          <p className="truncate text-xs text-muted">{owner || "—"}{l.discount > 0 ? ` · desconto ${money(Number(l.discount))}` : ""}</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-ink">{money(Number(l.final_value ?? 0))}{l.type === "recorrente" ? "/mês" : ""}</span>
        {!readOnly && (
          <button onClick={() => remove(l.id)} disabled={busy === l.id} className="shrink-0 rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500 disabled:opacity-50">
            {busy === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {/* Recorrentes */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted"><Repeat className="h-3.5 w-3.5" /> Recorrentes</p>
          <span className="text-xs text-muted">MRR {money(mrr)}</span>
        </div>
        {recorrentes.length === 0 ? (
          <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">Nenhum serviço recorrente.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">{recorrentes.map(renderLine)}</ul>
        )}
      </div>

      {/* Pontuais */}
      <div>
        <p className="mb-1 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted"><Zap className="h-3.5 w-3.5" /> Pontuais</p>
        {pontuais.length === 0 ? (
          <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">Nenhum serviço pontual.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">{pontuais.map(renderLine)}</ul>
        )}
      </div>

      {/* Adicionar */}
      {!readOnly && (
        <div className="rounded-xl border border-dashed border-line p-3">
          <div className="mb-2 inline-flex overflow-hidden rounded-lg border border-line text-xs">
            {(["recorrente", "pontual"] as const).map((t) => (
              <button key={t} onClick={() => { setType(t); setServiceId(""); setPlanId(""); setBase(""); }} className={cn("px-3 py-1.5 font-medium capitalize", type === t ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>
                {t}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <select value={serviceId} onChange={(e) => onService(e.target.value)} className={inputCls + " col-span-2 sm:col-span-1"}>
              <option value="">Serviço…</option>
              {options.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
            <select value={planId} onChange={(e) => onPlan(e.target.value)} className={inputCls} disabled={!selectedSvc?.plans.length}>
              <option value="">{selectedSvc?.plans.length ? (type === "recorrente" ? "Plano…" : "Formato…") : "Sem plano"}</option>
              {selectedSvc?.plans.map((pl) => <option key={pl.id} value={pl.id}>{pl.label}</option>)}
            </select>
            {type === "recorrente" ? (
              <select value={squadId} onChange={(e) => setSquadId(e.target.value)} className={inputCls}>
                <option value="">Squad…</option>
                {squads.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            ) : (
              <select value={executorId} onChange={(e) => setExecutorId(e.target.value)} className={inputCls}>
                <option value="">Executor…</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <input value={base} onChange={(e) => setBase(e.target.value)} inputMode="decimal" placeholder="Valor (R$)" className={inputCls} />
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} inputMode="decimal" placeholder="Desconto (R$)" className={inputCls} />
            <button onClick={add} disabled={busy === "add"} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy === "add" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
