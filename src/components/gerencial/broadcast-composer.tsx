"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bold, CalendarClock, Download, FileSpreadsheet, Italic, Loader2, RefreshCw, Save, Send, Sparkles,
  Strikethrough, Upload, Users, Users2, Image as ImageIcon, Video, Mic, FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  MSG_TYPES, SHEET_TEMPLATE, parseNumberList, sheetToRecipients,
  type BroadcastMsgType, type SheetRecipient,
} from "@/lib/data/broadcasts";

type WaGroup = { jid: string; name: string; participants: number };
type WaInstance = { id: string; name: string; connected: boolean };
const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

const MSG_ICON: Record<BroadcastMsgType, ReactNode> = {
  text: <FileText className="h-4 w-4" />,
  image: <ImageIcon className="h-4 w-4" />,
  video: <Video className="h-4 w-4" />,
  audio: <Mic className="h-4 w-4" />,
  document: <FileText className="h-4 w-4" />,
};

function AudienceChip({ active, onClick, icon, label, count }: { active: boolean; onClick: () => void; icon: ReactNode; label: string; count: number }) {
  return (
    <button type="button" onClick={onClick}
      className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-sm", active ? "border-brand-400 bg-brand-50 text-ink" : "border-line bg-surface text-muted hover:text-ink")}>
      {icon}<span className="font-medium">{label}</span>
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
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [instanceId, setInstanceId] = useState("");
  const [loadingInst, setLoadingInst] = useState(false);

  const [msgType, setMsgType] = useState<BroadcastMsgType>("text");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const [useClients, setUseClients] = useState(false);
  const [useLeads, setUseLeads] = useState(false);
  const [extraText, setExtraText] = useState("");
  const [sheet, setSheet] = useState<{ headers: string[]; recipients: SheetRecipient[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [groups, setGroups] = useState<WaGroup[]>([]);
  const [groupsLoaded, setGroupsLoaded] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Record<string, string>>({});

  const [unit, setUnit] = useState<"s" | "m">("s");
  const [delayMin, setDelayMin] = useState(2);
  const [delayMax, setDelayMax] = useState(6);
  const [aiRewrite, setAiRewrite] = useState(false);
  const [schedule, setSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [busy, setBusy] = useState<"draft" | "go" | null>(null);

  useEffect(() => {
    loadInstances();
  }, []);

  async function loadInstances() {
    setLoadingInst(true);
    try {
      const res = await fetch("/api/gerencial/broadcasts/instances");
      const j = await res.json().catch(() => null);
      const list = (j?.instances ?? []) as WaInstance[];
      setInstances(list);
      setInstanceId((cur) => cur || list[0]?.id || "");
    } finally {
      setLoadingInst(false);
    }
  }

  const paste = parseNumberList(extraText);
  const pastedNumbers = paste.numbers;
  const pastedGroups = paste.groups;
  const sheetCount = sheet?.recipients.length ?? 0;
  const estimate =
    (useClients ? clientsWithWa : 0) + (useLeads ? leadsWithPhone : 0) +
    pastedNumbers.length + pastedGroups.length + Object.keys(selectedGroups).length + sheetCount;

  async function loadGroups(force = false) {
    setLoadingGroups(true);
    try {
      const qs = new URLSearchParams();
      if (force) qs.set("force", "1");
      if (instanceId) qs.set("instance", instanceId);
      const res = await fetch(`/api/gerencial/broadcasts/groups?${qs}`);
      const j = await res.json().catch(() => null);
      if (!res.ok) { toast(j?.error ?? "Não foi possível listar grupos.", "error"); return; }
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

  // Inserção de formatação/variável na posição do cursor.
  function surround(before: string, after = before) {
    const el = msgRef.current;
    if (!el) return;
    const s = el.selectionStart ?? message.length;
    const e = el.selectionEnd ?? message.length;
    const sel = message.slice(s, e);
    const next = message.slice(0, s) + before + sel + after + message.slice(e);
    setMessage(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = s + before.length;
      el.selectionEnd = e + before.length;
    });
  }
  function insert(token: string) {
    const el = msgRef.current;
    const at = el?.selectionStart ?? message.length;
    setMessage(message.slice(0, at) + token + message.slice(at));
    requestAnimationFrame(() => { if (el) { el.focus(); el.selectionStart = el.selectionEnd = at + token.length; } });
  }

  function downloadTemplate() {
    const blob = new Blob([SHEET_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-disparo.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(file: File) {
    try {
      const buf = await file.arrayBuffer();
      const XLSX = await import("xlsx");
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, blankrows: false }) as unknown[][];
      const parsed = sheetToRecipients(aoa);
      if (parsed.recipients.length === 0) { toast("Nenhum número válido na planilha (1ª coluna = número).", "error"); return; }
      setSheet(parsed);
      toast(`${parsed.recipients.length} contato(s) importado(s).`, "success");
    } catch {
      toast("Não foi possível ler o arquivo.", "error");
    }
  }

  async function submit(kind: "draft" | "go") {
    const isMedia = msgType !== "text";
    if (!message.trim() && !isMedia) { toast("Escreva a mensagem.", "error"); return; }
    if (isMedia && !mediaUrl.trim()) { toast("Informe a URL da mídia.", "error"); return; }
    if (estimate === 0) { toast("Escolha ao menos um público.", "error"); return; }
    if (kind === "go" && schedule && !scheduledFor) { toast("Defina a data/hora do agendamento.", "error"); return; }
    const mode = kind === "draft" ? "draft" : schedule ? "scheduled" : "now";
    if (mode === "now" && !window.confirm(`Disparar agora para ~${estimate} destinatário(s)?`)) return;

    const factor = unit === "m" ? 60 : 1;
    setBusy(kind);
    try {
      const res = await fetch("/api/gerencial/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          mode,
          title: (message.trim().split("\n")[0] || (isMedia ? `Disparo de ${msgType}` : "Disparo")).slice(0, 60),
          message,
          msgType,
          mediaUrl: isMedia ? mediaUrl.trim() : undefined,
          instanceId: instanceId || undefined,
          delayMin: delayMin * factor,
          delayMax: delayMax * factor,
          aiRewrite,
          scheduledFor: mode === "scheduled" ? new Date(scheduledFor).toISOString() : undefined,
          audiences: {
            clients: useClients,
            leads: useLeads,
            numbers: pastedNumbers,
            groups: [
              ...Object.entries(selectedGroups).map(([jid, name]) => ({ jid, name })),
              ...pastedGroups.map((jid) => ({ jid, name: "" })),
            ],
            rows: (sheet?.recipients ?? []).map((r) => ({ number: r.target, name: r.name, vars: r.vars })),
          },
        }),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) { toast(j?.error ?? "Não foi possível criar o disparo.", "error"); return; }
      toast(mode === "now" ? "Disparo iniciado." : mode === "scheduled" ? "Disparo agendado." : "Rascunho salvo.", "success");
      onDone(j?.id);
    } finally {
      setBusy(null);
    }
  }

  const isMedia = msgType !== "text";

  return (
    <Card className="space-y-5 p-5">
      {/* Instância / atendente */}
      <div>
        <div className="flex items-center justify-between">
          <span className={labelCls}>Atendente / instância</span>
          <button type="button" onClick={loadInstances} disabled={loadingInst} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink">
            {loadingInst ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Atualizar
          </button>
        </div>
        <select value={instanceId} onChange={(e) => setInstanceId(e.target.value)} className={inputCls}>
          {instances.length === 0 && <option value="">Nenhuma instância — configure em Integrações</option>}
          {instances.map((i) => <option key={i.id} value={i.id}>{i.name}{i.connected ? " · conectado" : " · offline"}</option>)}
        </select>
      </div>

      {/* Tipo de mensagem */}
      <div>
        <span className={labelCls}>Tipo de mensagem</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MSG_TYPES.map((t) => (
            <button key={t.key} type="button" onClick={() => setMsgType(t.key)}
              className={cn("flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium", msgType === t.key ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-ink")}>
              {MSG_ICON[t.key]} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mensagem + toolbar */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className={labelCls}>Mensagem / legenda</span>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => surround("*")} className="rounded-md border border-line px-2 py-1 text-xs font-bold text-ink hover:bg-subtle" title="Negrito"><Bold className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => surround("_")} className="rounded-md border border-line px-2 py-1 text-xs text-ink hover:bg-subtle" title="Itálico"><Italic className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => surround("~")} className="rounded-md border border-line px-2 py-1 text-xs text-ink hover:bg-subtle" title="Tachado"><Strikethrough className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => insert("{nome}")} className="ml-1 rounded-md border border-line px-2 py-1 font-mono text-xs text-ink hover:bg-subtle" title="Inserir variável">+ {"{nome}"}</button>
          </div>
        </div>
        <textarea ref={msgRef} value={message} onChange={(e) => setMessage(e.target.value)} rows={4}
          placeholder="Digite sua mensagem… Ex.: Olá {nome}, tudo bem?" className={inputCls + " resize-y"} />
        <p className="mt-1.5 text-[11px] text-muted">
          Formatação do WhatsApp: <code className="rounded bg-subtle px-1">*negrito*</code>, <code className="rounded bg-subtle px-1">_itálico_</code>, <code className="rounded bg-subtle px-1">~tachado~</code>. Variáveis: <code className="rounded bg-subtle px-1">{"{nome}"}</code> e cada coluna da planilha (ex.: <code className="rounded bg-subtle px-1">{"{empresa}"}</code>) — sem valor fica vazia.
        </p>
      </div>

      {isMedia && (
        <label className="block">
          <span className={labelCls}>URL da mídia ({msgType})</span>
          <input value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://…/arquivo" className={inputCls} />
        </label>
      )}

      {/* Públicos */}
      <div className="space-y-3 border-t border-line pt-4">
        <span className={labelCls}>Públicos</span>
        <div className="flex flex-wrap gap-2">
          <AudienceChip active={useClients} onClick={() => setUseClients((v) => !v)} icon={<Users className="h-4 w-4" />} label="Clientes" count={clientsWithWa} />
          <AudienceChip active={useLeads} onClick={() => setUseLeads((v) => !v)} icon={<Users2 className="h-4 w-4" />} label="Leads do CRM" count={leadsWithPhone} />
        </div>

        {/* Lista extra / planilha */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={labelCls}>Lista extra (planilha / colar)</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={downloadTemplate} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"><Download className="h-3.5 w-3.5" /> Baixar modelo</button>
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-ink"><Upload className="h-3.5 w-3.5" /> Importar CSV/XLSX</button>
              <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
            </div>
          </div>
          <textarea value={extraText} onChange={(e) => setExtraText(e.target.value)} rows={2}
            placeholder="Cole números (um por linha) ou IDs de grupo (…@g.us). Ou importe um CSV/XLSX." className={inputCls + " resize-y"} />
          <p className="mt-1 text-[11px] text-muted">
            Números viram contato individual; itens com <code className="rounded bg-subtle px-1">@g.us</code> viram grupo. Duplicados são removidos. Na planilha, a <b>1ª coluna é o número</b> e cada coluna extra vira uma variável <code className="rounded bg-subtle px-1">{"{cabeçalho}"}</code>.
          </p>
          {sheet && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-subtle px-3 py-2 text-xs">
              <span className="text-ink"><FileSpreadsheet className="mr-1 inline h-3.5 w-3.5" />{sheet.recipients.length} contato(s){sheet.headers.length > 1 ? ` · variáveis: ${sheet.headers.slice(1).map((h) => `{${h}}`).join(", ")}` : ""}</span>
              <button type="button" onClick={() => setSheet(null)} className="font-medium text-muted hover:text-ink">remover</button>
            </div>
          )}
        </div>

        {/* Grupos */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className={labelCls}>Grupos de WhatsApp</span>
            <button type="button" onClick={() => loadGroups(groupsLoaded)} disabled={loadingGroups} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-subtle disabled:opacity-60">
              {loadingGroups ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}{groupsLoaded ? "Recarregar" : "Carregar grupos"}
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

      {/* Intervalo anti-ban */}
      <div className="border-t border-line pt-4">
        <div className="mb-1 flex items-center justify-between">
          <span className={labelCls}>Intervalo entre mensagens</span>
          <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
            {(["s", "m"] as const).map((u) => (
              <button key={u} type="button" onClick={() => setUnit(u)} className={cn("px-3 py-1 font-medium", unit === u ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink")}>
                {u === "s" ? "Segundos" : "Minutos"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Mínimo ({unit === "s" ? "segundos" : "minutos"})</span>
            <input type="number" min={0} value={delayMin} onChange={(e) => setDelayMin(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Máximo ({unit === "s" ? "segundos" : "minutos"})</span>
            <input type="number" min={0} value={delayMax} onChange={(e) => setDelayMax(Math.max(0, Number(e.target.value) || 0))} className={inputCls} />
          </label>
        </div>
        <p className="mt-1.5 text-[11px] text-muted">Após cada mensagem o sistema espera um tempo <b>aleatório entre o mínimo e o máximo</b> (anti-bloqueio).</p>
      </div>

      {/* Opções */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm", aiRewrite ? "border-brand-400 bg-brand-50" : "border-line")}>
          <input type="checkbox" checked={aiRewrite} onChange={(e) => setAiRewrite(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          <Sparkles className="h-4 w-4 text-brand-500" /> <span className="font-medium text-ink">Reescrever com IA (anti-ban)</span>
        </label>
        <label className={cn("flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-3 text-sm", schedule ? "border-brand-400 bg-brand-50" : "border-line")}>
          <input type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="h-4 w-4 accent-brand-600" />
          <CalendarClock className="h-4 w-4 text-brand-500" /> <span className="font-medium text-ink">Agendar disparo</span>
        </label>
      </div>
      {schedule && (
        <label className="block">
          <span className={labelCls}>Data e hora</span>
          <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} className={inputCls} />
        </label>
      )}

      {/* Ações */}
      <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">~{estimate} destinatário(s)</span>
          <button onClick={() => submit("draft")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60">
            {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Rascunho
          </button>
        </div>
        <button onClick={() => submit("go")} disabled={!!busy} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-ink px-5 py-3 text-sm font-semibold text-white hover:bg-ink/90 disabled:opacity-60">
          {busy === "go" ? <Loader2 className="h-4 w-4 animate-spin" /> : schedule ? <CalendarClock className="h-4 w-4" /> : <Send className="h-4 w-4" />}
          {schedule ? "Agendar disparo" : "Disparar"}
        </button>
      </div>
    </Card>
  );
}
