"use client";

import { useState, type ReactNode } from "react";
import { CalendarClock, Loader2, RefreshCw, Save, Send, Users2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { parseNumberList } from "@/lib/data/broadcasts";

type WaGroup = { jid: string; name: string; participants: number };
const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

function AudienceChip({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm",
        active ? "border-brand-400 bg-brand-50 text-ink" : "border-line bg-surface text-muted hover:text-ink",
      )}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className={cn("rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-brand-600 text-white" : "bg-subtle text-muted")}>{count}</span>
    </button>
  );
}

export function BroadcastComposer({
  clientsWithWa,
  leadsWithPhone,
  onDone,
}: {
  clientsWithWa: number;
  leadsWithPhone: number;
  onDone: (id?: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "document">("image");
  const [delaySeconds, setDelaySeconds] = useState(8);

  const [useClients, setUseClients] = useState(false);
  const [useLeads, setUseLeads] = useState(false);
  const [numbersText, setNumbersText] = useState("");

  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string>>({}); // jid -> name

  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState<"draft" | "now" | "scheduled" | null>(null);

  const manualCount = parseNumberList(numbersText).length;
  const estimate =
    (useClients ? clientsWithWa : 0) + (useLeads ? leadsWithPhone : 0) + manualCount + Object.keys(selectedGroups).length;

  async function loadGroups(force = false) {
    setLoadingGroups(true);
    try {
      const res = await fetch(`/api/gerencial/broadcasts/groups${force ? "?force=1" : ""}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.error ?? "Não foi possível listar grupos.", "error");
        return;
      }
      if (j?.configured === false) toast("WhatsApp não configurado — conecte a Uazapi em Integrações.", "error");
      setGroups((j?.groups ?? []) as WaGroup[]);
      setGroupsLoaded(true);
    } finally {
      setLoadingGroups(false);
    }
  }

  function toggleGroup(g: WaGroup) {
    setSelectedGroups((prev) => {
      const next = { ...prev };
      if (next[g.jid]) delete next[g.jid];
      else next[g.jid] = g.name;
      return next;
    });
  }

  async function submit(mode: "draft" | "now" | "scheduled") {
    if (!message.trim() && !mediaUrl.trim()) {
      toast("Escreva a mensagem (ou informe uma mídia).", "error");
      return;
    }
    if (estimate === 0) {
      toast("Escolha ao menos um público.", "error");
      return;
    }
    if (mode === "scheduled" && !scheduledFor) {
      toast("Defina a data/hora do agendamento.", "error");
      return;
    }
    if (mode === "now" && !window.confirm(`Enviar agora para ~${estimate} destinatário(s)?`)) return;

    setBusy(mode);
    try {
      const res = await fetch("/api/gerencial/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          mode,
          title,
          message,
          mediaUrl: mediaUrl.trim() || undefined,
          mediaType,
          delaySeconds,
          scheduledFor: mode === "scheduled" ? new Date(scheduledFor).toISOString() : undefined,
          audiences: {
            clients: useClients,
            leads: useLeads,
            numbers: parseNumberList(numbersText),
            groups: Object.entries(selectedGroups).map(([jid, name]) => ({ jid, name })),
          },
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) {
        toast(j?.error ?? "Não foi possível criar o disparo.", "error");
        return;
      }
      toast(mode === "now" ? "Disparo iniciado." : mode === "scheduled" ? "Disparo agendado." : "Rascunho salvo.", "success");
      onDone(j?.id);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-5 p-5">
      {/* Mensagem */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Título interno</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Promoção de aniversário" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Intervalo entre envios (s)</span>
          <input type="number" min={1} max={120} value={delaySeconds} onChange={(e) => setDelaySeconds(Number(e.target.value) || 8)} className={inputCls} />
        </label>
      </div>

      <label className="block">
        <span className={labelCls}>Mensagem</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} placeholder="Escreva aqui… Use {nome} ou {primeiro_nome} para personalizar." className={inputCls + " resize-y"} />
        <span className="mt-1 block text-[11px] text-muted">Personalização: <code className="rounded bg-subtle px-1">{"{nome}"}</code> e <code className="rounded bg-subtle px-1">{"{primeiro_nome}"}</code> (grupos não personalizam).</span>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block sm:col-span-2">
          <span className={labelCls}>Mídia (URL pública, opcional)</span>
          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…/imagem.jpg" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Tipo de mídia</span>
          <select value={mediaType} onChange={(e) => setMediaType(e.target.value as "image" | "video" | "document")} className={inputCls} disabled={!mediaUrl.trim()}>
            <option value="image">Imagem</option>
            <option value="video">Vídeo</option>
            <option value="document">Documento</option>
          </select>
        </label>
      </div>

      {/* Públicos */}
      <div className="space-y-3 border-t border-line pt-4">
        <p className={labelCls}>Públicos</p>
        <div className="flex flex-wrap gap-2">
          <AudienceChip active={useClients} onClick={() => setUseClients((v) => !v)} icon={<Users className="h-4 w-4" />} label="Clientes" count={clientsWithWa} />
          <AudienceChip active={useLeads} onClick={() => setUseLeads((v) => !v)} icon={<Users2 className="h-4 w-4" />} label="Leads do CRM" count={leadsWithPhone} />
        </div>

        <label className="block">
          <span className={labelCls}>Lista manual de números</span>
          <textarea value={numbersText} onChange={(e) => setNumbersText(e.target.value)} rows={2} placeholder="Um por linha ou separados por vírgula. Ex.: 27999998888 (DDI 55 é assumido)" className={inputCls + " resize-y"} />
          {manualCount > 0 && <span className="mt-1 block text-[11px] text-muted">{manualCount} número(s) válido(s).</span>}
        </label>

        {/* Grupos */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={labelCls}>Grupos de WhatsApp</span>
            <button
              type="button"
              onClick={() => loadGroups(groupsLoaded)}
              disabled={loadingGroups}
              className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60"
            >
              {loadingGroups ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {groupsLoaded ? "Recarregar" : "Carregar grupos"}
            </button>
          </div>
          {groupsLoaded && groups.length === 0 && <p className="rounded-lg bg-subtle px-3 py-2 text-xs text-muted">Nenhum grupo encontrado (ou a instância não retornou a lista).</p>}
          {groups.length > 0 && (
            <div className="max-h-52 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
              {groups.map((g) => (
                <label key={g.jid} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-subtle">
                  <input type="checkbox" checked={!!selectedGroups[g.jid]} onChange={() => toggleGroup(g)} className="h-4 w-4 accent-brand-600" />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{g.name}</span>
                  {g.participants > 0 && <span className="shrink-0 text-[11px] text-muted">{g.participants} membros</span>}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Agendamento + ações */}
      <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-end sm:justify-between">
        <label className="block">
          <span className={labelCls}>Agendar para (opcional)</span>
          <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className={inputCls} />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-sm text-muted">~{estimate} destinatário(s)</span>
          <button onClick={() => submit("draft")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60">
            {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Rascunho
          </button>
          <button onClick={() => submit("scheduled")} disabled={!!busy || !scheduledFor} className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50">
            {busy === "scheduled" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />} Agendar
          </button>
          <button onClick={() => submit("now")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy === "now" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar agora
          </button>
        </div>
      </div>
    </Card>
  );
}
