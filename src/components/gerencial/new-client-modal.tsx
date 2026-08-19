"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Star, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

const CLIENT_TYPES: { value: string; label: string; hint: string }[] = [
  { value: "lead_gen", label: "Geração de leads", hint: "CPL / conversões" },
  { value: "ecommerce", label: "E-commerce", hint: "Pedidos / ROAS" },
  { value: "local_business", label: "Negócio local", hint: "Alcance / visitas" },
];

const NETWORKS: { value: string; label: string }[] = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "youtube", label: "YouTube" },
  { value: "google_business", label: "Google Business" },
];

const RESP_ROLES = [
  { key: "social", label: "Social" },
  { key: "performance", label: "Performance" },
  { key: "designer", label: "Designer" },
  { key: "copy", label: "Editor de Vídeo" },
  { key: "desenvolvedor", label: "Desenvolvedor" },
] as const;
const COMMON_SERVICES = ["Social", "Tráfego", "Design", "Copy", "UGC", "Site", "E-commerce"];
const DEL_FORMATS = ["Reels", "Feed", "Stories", "Carrossel"] as const;

type Svc = { id: string; label: string; type: string; area: string; plans: { id: string; label: string; defaultPrice: number }[] };
type Squad = { id: string; name: string; area: string };
type Person = { id: string; name: string; squadId: string | null; canBePo: boolean };
type Catalog = { services: Svc[]; squads: Squad[]; people: Person[] };

type RecLine = { key: number; serviceId: string; planId: string; base: string; discount: string; squadId: string; analystId: string };
type PntLine = { key: number; serviceId: string; planId: string; base: string; discount: string; executorId: string; poId: string };
type ContactRow = { key: number; name: string; role: string; whatsapp: string; email: string; isPrimary: boolean };

let seq = 1;
const nextKey = () => seq++;
const money = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (v: string) => { const n = Number(String(v).replace(/\./g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
const lineFinal = (l: { base: string; discount: string }) => Math.max(0, num(l.base) - num(l.discount));

const inputCls = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-50";
const selCls = inputCls;

export function NewClientButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cat, setCat] = useState<Catalog>({ services: [], squads: [], people: [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bloco 1
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [clientType, setClientType] = useState("local_business");
  const [segment, setSegment] = useState("");
  // Blocos 2/3
  const [recurring, setRecurring] = useState<RecLine[]>([]);
  const [pontual, setPontual] = useState<PntLine[]>([]);
  // Bloco 5
  const [csMainId, setCsMainId] = useState("");
  const [csSupportId, setCsSupportId] = useState("");
  // Bloco 5b · Equipe responsável + operação (opcional na criação)
  const [resp, setResp] = useState<Record<string, string>>({ social: "", performance: "", designer: "", copy: "", desenvolvedor: "" });
  const [svcTags, setSvcTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [dels, setDels] = useState<Record<string, number>>({});
  // Bloco 6
  const [contacts, setContacts] = useState<ContactRow[]>([{ key: nextKey(), name: "", role: "", whatsapp: "", email: "", isPrimary: true }]);
  // Bloco 7
  const [kickoffDate, setKickoffDate] = useState("");
  const [networks, setNetworks] = useState<string[]>(["instagram", "facebook"]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    void fetch("/api/gerencial/clients", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => { if (alive) setCat({ services: j.services ?? [], squads: j.squads ?? [], people: j.people ?? [] }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  const recServices = cat.services.filter((s) => s.type === "recorrente");
  const pntServices = cat.services.filter((s) => s.type === "pontual");
  const poPeople = cat.people.filter((p) => p.canBePo);

  const feeMensal = recurring.reduce((a, l) => a + lineFinal(l), 0);
  const pontualTotal = pontual.reduce((a, l) => a + lineFinal(l), 0);
  const svcById = (id: string) => cat.services.find((s) => s.id === id);
  const activeAreas = [...new Set([
    ...recurring.map((l) => svcById(l.serviceId)?.area).filter(Boolean),
    ...pontual.map((l) => svcById(l.serviceId)?.area).filter(Boolean),
  ])] as string[];
  const activeSquads = [...new Set(recurring.map((l) => cat.squads.find((s) => s.id === l.squadId)?.name).filter(Boolean))] as string[];
  const hasTraffic = recurring.some((l) => svcById(l.serviceId)?.area === "Performance");

  function reset() {
    setName(""); setCity(""); setClientType("local_business"); setSegment("");
    setRecurring([]); setPontual([]); setCsMainId(""); setCsSupportId("");
    setResp({ social: "", performance: "", designer: "", copy: "", desenvolvedor: "" }); setSvcTags([]); setNewTag(""); setDels({});
    setContacts([{ key: nextKey(), name: "", role: "", whatsapp: "", email: "", isPrimary: true }]);
    setKickoffDate(""); setNetworks(["instagram", "facebook"]); setError(null);
  }

  // ── Recorrente ──
  function addRec() { setRecurring((p) => [...p, { key: nextKey(), serviceId: "", planId: "", base: "", discount: "", squadId: "", analystId: "" }]); }
  function setRec(key: number, patch: Partial<RecLine>) { setRecurring((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l))); }
  function onRecService(key: number, serviceId: string) { setRec(key, { serviceId, planId: "", base: "", discount: "", squadId: "", analystId: "" }); }
  function onRecPlan(key: number, planId: string, svc?: Svc) {
    const price = svc?.plans.find((pl) => pl.id === planId)?.defaultPrice ?? 0;
    setRec(key, { planId, base: price ? String(price) : "" });
  }

  // ── Pontual ──
  function addPnt() { setPontual((p) => [...p, { key: nextKey(), serviceId: "", planId: "", base: "", discount: "", executorId: "", poId: "" }]); }
  function setPnt(key: number, patch: Partial<PntLine>) { setPontual((p) => p.map((l) => (l.key === key ? { ...l, ...patch } : l))); }
  function onPntService(key: number, serviceId: string) { setPnt(key, { serviceId, planId: "", base: "", discount: "" }); }
  function onPntPlan(key: number, planId: string, svc?: Svc) {
    const price = svc?.plans.find((pl) => pl.id === planId)?.defaultPrice ?? 0;
    setPnt(key, { planId, base: price ? String(price) : "" });
  }

  // ── Contatos ──
  function addContact() { setContacts((p) => [...p, { key: nextKey(), name: "", role: "", whatsapp: "", email: "", isPrimary: p.length === 0 }]); }
  function setContact(key: number, patch: Partial<ContactRow>) { setContacts((p) => p.map((c) => (c.key === key ? { ...c, ...patch } : c))); }
  function makePrimary(key: number) { setContacts((p) => p.map((c) => ({ ...c, isPrimary: c.key === key }))); }
  function removeContact(key: number) {
    setContacts((p) => {
      const next = p.filter((c) => c.key !== key);
      if (next.length && !next.some((c) => c.isPrimary)) next[0].isPrimary = true;
      return next;
    });
  }

  function toggleNet(v: string) { setNetworks((p) => (p.includes(v) ? p.filter((x) => x !== v) : [...p, v])); }

  async function submit() {
    if (!name.trim()) { setError("Nome do cliente é obrigatório."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/gerencial/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, city, clientType, segment,
          activeNetworks: networks,
          kickoffDate: kickoffDate || undefined,
          csMainId: csMainId || undefined,
          csSupportId: csSupportId || undefined,
          recurring: recurring.filter((l) => l.serviceId).map((l) => ({ serviceId: l.serviceId, planId: l.planId || undefined, serviceLabel: svcById(l.serviceId)?.label, planLabel: svcById(l.serviceId)?.plans.find((p) => p.id === l.planId)?.label, baseValue: num(l.base), discount: num(l.discount), squadId: l.squadId || undefined, analystId: l.analystId || undefined })),
          pontual: pontual.filter((l) => l.serviceId).map((l) => ({ serviceId: l.serviceId, planId: l.planId || undefined, serviceLabel: svcById(l.serviceId)?.label, planLabel: svcById(l.serviceId)?.plans.find((p) => p.id === l.planId)?.label, baseValue: num(l.base), discount: num(l.discount), executorId: l.executorId || undefined, poId: l.poId || undefined })),
          contacts: contacts.filter((c) => c.name.trim()).map((c) => ({ name: c.name, role: c.role, whatsapp: c.whatsapp, email: c.email, isPrimary: c.isPrimary })),
          responsibles: resp,
          servicesList: svcTags,
          deliverables: dels,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error ?? "Falha ao criar cliente."); return; }
      setOpen(false);
      reset();
      if (data.id && data.id !== "demo") router.push(`/gerencial/clientes/${data.id}`);
      else router.refresh();
    } catch {
      setError("Falha de rede ao criar cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        <Plus className="h-4 w-4" /> Novo cliente
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={() => setOpen(false)}>
          <div className="w-full max-w-3xl rounded-2xl border border-line bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <div>
                <h2 className="text-sm font-semibold text-ink">Novo cliente</h2>
                <p className="text-xs text-muted">Cadastro enxuto — só o essencial para alocar o cliente no time. O resto vai na ficha.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
            </div>

            <div className="max-h-[70vh] space-y-5 overflow-y-auto p-5">
              {/* Bloco 1 · Identificação */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-muted">Nome do cliente *</span>
                  <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Ex.: Restaurante Sabor do Mar" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Cidade</span>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Segmento</span>
                  <input value={segment} onChange={(e) => setSegment(e.target.value)} className={inputCls} placeholder="Ex.: Gastronomia" />
                </label>
                <div className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-muted">Tipo de negócio *</span>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                    {CLIENT_TYPES.map((t) => (
                      <button key={t.value} onClick={() => setClientType(t.value)} className={cn("rounded-xl border px-3 py-2 text-left", clientType === t.value ? "border-brand-400 bg-brand-500/10" : "border-line hover:bg-subtle")}>
                        <p className="text-sm font-medium text-ink">{t.label}</p>
                        <p className="text-[11px] text-muted">{t.hint}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </section>

              {/* Bloco 2 · Recorrentes */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Serviços recorrentes · VioDelivery</h3>
                  <button onClick={addRec} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
                </div>
                {recurring.length === 0 && <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">Nenhum serviço recorrente.</p>}
                <div className="space-y-2">
                  {recurring.map((l) => {
                    const svc = svcById(l.serviceId);
                    const squadOpts = svc
                      ? [...cat.squads].sort((a, b) => Number(b.area === svc.area) - Number(a.area === svc.area))
                      : cat.squads;
                    const analystOpts = l.squadId ? (cat.people.filter((p) => p.squadId === l.squadId).length ? cat.people.filter((p) => p.squadId === l.squadId) : cat.people) : [];
                    return (
                      <div key={l.key} className="rounded-xl border border-line p-2.5">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <select value={l.serviceId} onChange={(e) => onRecService(l.key, e.target.value)} className={selCls}>
                            <option value="">Serviço…</option>
                            {recServices.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                          <select value={l.planId} onChange={(e) => onRecPlan(l.key, e.target.value, svc)} disabled={!svc} className={selCls}>
                            <option value="">Plano…</option>
                            {svc?.plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                          <div className="flex items-center gap-1">
                            {svc && <span className="shrink-0 rounded-md bg-subtle px-1.5 py-1 text-[10px] font-semibold text-muted">{svc.area}</span>}
                            <select value={l.squadId} onChange={(e) => setRec(l.key, { squadId: e.target.value, analystId: "" })} disabled={!svc} className={selCls}>
                              <option value="">Squad…</option>
                              {squadOpts.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <select value={l.analystId} onChange={(e) => setRec(l.key, { analystId: e.target.value })} disabled={!l.squadId} className={selCls}>
                            <option value="">{l.squadId ? "Analista (líder define depois)" : "Analista…"}</option>
                            {analystOpts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <input value={l.base} onChange={(e) => setRec(l.key, { base: e.target.value })} disabled={!l.serviceId} inputMode="decimal" placeholder="Valor base" className={inputCls} />
                          <input value={l.discount} onChange={(e) => setRec(l.key, { discount: e.target.value })} disabled={!l.serviceId} inputMode="decimal" placeholder="Desconto R$" className={inputCls} />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[11px] text-muted">Final: <span className="font-semibold text-ink">{money(lineFinal(l))}</span></span>
                          <button onClick={() => setRecurring((p) => p.filter((x) => x.key !== l.key))} className="text-muted hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Bloco 3 · Pontuais */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Serviços pontuais · VioProjects</h3>
                  <button onClick={addPnt} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
                </div>
                <div className="space-y-2">
                  {pontual.map((l) => {
                    const svc = svcById(l.serviceId);
                    return (
                      <div key={l.key} className="rounded-xl border-l-4 border-l-amber-400 border-y border-r border-line p-2.5">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                          <select value={l.serviceId} onChange={(e) => onPntService(l.key, e.target.value)} className={selCls}>
                            <option value="">Serviço…</option>
                            {pntServices.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                          </select>
                          <select value={l.planId} onChange={(e) => onPntPlan(l.key, e.target.value, svc)} disabled={!svc} className={selCls}>
                            <option value="">Formato…</option>
                            {svc?.plans.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                          </select>
                          <select value={l.executorId} onChange={(e) => setPnt(l.key, { executorId: e.target.value })} className={selCls}>
                            <option value="">Responsável técnico…</option>
                            {cat.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <select value={l.poId} onChange={(e) => setPnt(l.key, { poId: e.target.value })} className={selCls}>
                            <option value="">PO do projeto…</option>
                            {poPeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                          <input value={l.base} onChange={(e) => setPnt(l.key, { base: e.target.value })} disabled={!l.serviceId} inputMode="decimal" placeholder="Valor base" className={inputCls} />
                          <input value={l.discount} onChange={(e) => setPnt(l.key, { discount: e.target.value })} disabled={!l.serviceId} inputMode="decimal" placeholder="Desconto R$" className={inputCls} />
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-[11px] text-muted">Final: <span className="font-semibold text-ink">{money(lineFinal(l))}</span></span>
                          <button onClick={() => setPontual((p) => p.filter((x) => x.key !== l.key))} className="text-muted hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Bloco 4 · Resumo derivado */}
              {(recurring.length > 0 || pontual.length > 0) && (
                <section className="rounded-xl bg-subtle p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="text-muted">Fee mensal <span className="text-[10px]">(soma dos recorrentes)</span>: <span className="font-bold text-ink">{money(feeMensal)}</span></span>
                    {pontualTotal > 0 && <span className="text-muted">Pontuais (única): <span className="font-bold text-ink">{money(pontualTotal)}</span></span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {activeAreas.map((a) => <span key={a} className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[10px] font-medium text-brand-600">{a}</span>)}
                    {activeSquads.map((s) => <span key={s} className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-ink">{s}</span>)}
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", hasTraffic ? "bg-emerald-500/15 text-emerald-600" : "bg-subtle-strong text-muted")}>{hasTraffic ? "Com tráfego pago" : "Sem tráfego pago"}</span>
                  </div>
                </section>
              )}

              {/* Bloco 5 · Atendimento */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">CS principal *</span>
                  <select value={csMainId} onChange={(e) => setCsMainId(e.target.value)} className={selCls}>
                    <option value="">Selecione…</option>
                    {cat.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">CS de apoio</span>
                  <select value={csSupportId} onChange={(e) => setCsSupportId(e.target.value)} className={selCls}>
                    <option value="">—</option>
                    {cat.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              </section>

              {/* Bloco 5b · Equipe responsável + operação */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Equipe responsável</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {RESP_ROLES.map((r) => (
                    <label key={r.key} className="block">
                      <span className="mb-1 block text-xs font-medium text-muted">{r.label}</span>
                      <select value={resp[r.key]} onChange={(e) => setResp((s) => ({ ...s, [r.key]: e.target.value }))} className={selCls}>
                        <option value="">—</option>
                        {cat.people.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                      </select>
                    </label>
                  ))}
                </div>

                <div>
                  <span className="mb-1 block text-xs font-medium text-muted">Serviços</span>
                  {svcTags.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap gap-1.5">
                      {svcTags.map((s) => (
                        <span key={s} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-ink">
                          {s}
                          <button type="button" onClick={() => setSvcTags((a) => a.filter((x) => x !== s))} className="text-muted hover:text-rose-500" aria-label={`Remover ${s}`}><X className="h-3 w-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        const v = newTag.trim();
                        if (v && !svcTags.includes(v)) setSvcTags((a) => [...a, v]);
                        setNewTag("");
                      }}
                      placeholder="Adicionar serviço"
                      className="h-8 w-40 rounded-lg border border-line bg-surface px-2.5 text-xs text-ink outline-none focus:border-brand-400"
                    />
                    {COMMON_SERVICES.filter((s) => !svcTags.includes(s)).map((s) => (
                      <button key={s} type="button" onClick={() => setSvcTags((a) => [...a, s])} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink"><Plus className="h-3 w-3" /> {s}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="mb-1 block text-xs font-medium text-muted">Entregáveis do mês</span>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {DEL_FORMATS.map((f) => (
                      <label key={f} className="text-[11px] text-muted">
                        {f}
                        <input type="number" min={0} max={99} value={dels[f] ?? 0} onChange={(e) => setDels((d) => ({ ...d, [f]: Math.max(0, Number(e.target.value) || 0) }))} className={inputCls} />
                      </label>
                    ))}
                  </div>
                </div>
              </section>

              {/* Bloco 6 · Contatos */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Contatos do cliente</h3>
                  <button onClick={addContact} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"><Plus className="h-3.5 w-3.5" /> Adicionar</button>
                </div>
                <div className="space-y-2">
                  {contacts.map((c) => (
                    <div key={c.key} className="rounded-xl border border-line p-2.5">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <input value={c.name} onChange={(e) => setContact(c.key, { name: e.target.value })} placeholder="Nome" className={inputCls} />
                        <input value={c.role} onChange={(e) => setContact(c.key, { role: e.target.value })} placeholder="Papel (ex: sócio)" className={inputCls} />
                        <input value={c.whatsapp} onChange={(e) => setContact(c.key, { whatsapp: e.target.value })} placeholder="WhatsApp" className={inputCls} />
                        <input value={c.email} onChange={(e) => setContact(c.key, { email: e.target.value })} placeholder="E-mail" className={inputCls} />
                      </div>
                      <div className="mt-1.5 flex items-center justify-between">
                        <button onClick={() => makePrimary(c.key)} className={cn("inline-flex items-center gap-1 text-[11px] font-medium", c.isPrimary ? "text-amber-600" : "text-muted hover:text-ink")}>
                          <Star className={cn("h-3.5 w-3.5", c.isPrimary && "fill-amber-400")} /> {c.isPrimary ? "Contato principal" : "Tornar principal"}
                        </button>
                        {contacts.length > 1 && <button onClick={() => removeContact(c.key)} className="text-muted hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>}
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Bloco 7 · Operação */}
              <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted">Data de kickoff</span>
                  <input type="date" value={kickoffDate} onChange={(e) => setKickoffDate(e.target.value)} className={inputCls} />
                </label>
                <div>
                  <span className="mb-1 block text-xs font-medium text-muted">Redes ativas</span>
                  <div className="flex flex-wrap gap-1.5">
                    {NETWORKS.map((n) => (
                      <button key={n.value} onClick={() => toggleNet(n.value)} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", networks.includes(n.value) ? "border-brand-400 bg-brand-500/10 text-ink" : "border-line text-muted hover:text-ink")}>{n.label}</button>
                    ))}
                  </div>
                </div>
              </section>

              {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-500">{error}</p>}
            </div>

            {/* Rodapé fixo */}
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line px-5 py-3.5">
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted">Fee mensal: <span className="font-bold text-ink">{money(feeMensal)}</span></span>
                {pontualTotal > 0 && <span className="border-l border-line pl-4 text-muted">Pontual (única): <span className="font-bold text-ink">{money(pontualTotal)}</span></span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setOpen(false)} className="rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-subtle">Cancelar</button>
                <button onClick={submit} disabled={saving || !name.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Criar cliente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
