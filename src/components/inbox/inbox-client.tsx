"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  FileText,
  Loader2,
  MessagesSquare,
  Mic,
  Paperclip,
  Search,
  Send,
  Square,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { clockLabel, dayMonth } from "@/lib/datetime";
import {
  WA_STATUS,
  conversationTitle,
  formatPhone,
  type Attendant,
  type WaConversation,
  type WaMessage,
  type WaStatus,
} from "@/lib/data/inbox";
import type { SalesMaterial } from "@/lib/data/crm";
import { InboxLeadPanel } from "./inbox-lead-panel";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function MessageBody({ m }: { m: WaMessage }) {
  if (m.mediaUrl && m.type === "image") {
    return (
      <a href={m.mediaUrl} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.mediaUrl} alt="imagem" className="max-h-64 rounded-lg" />
        {m.body && <p className="mt-1 whitespace-pre-wrap">{m.body}</p>}
      </a>
    );
  }
  if (m.mediaUrl && m.type === "audio") {
    return <audio controls src={m.mediaUrl} className="mt-0.5 max-w-[220px]" />;
  }
  if (m.mediaUrl && m.type === "video") {
    return <video controls src={m.mediaUrl} className="max-h-64 rounded-lg" />;
  }
  if (m.mediaUrl && m.type === "document") {
    return (
      <a
        href={m.mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 underline"
      >
        <FileText className="h-4 w-4" /> {m.body || "Documento"}
      </a>
    );
  }
  return <p className="whitespace-pre-wrap">{m.body}</p>;
}

function stamp(iso?: string) {
  if (!iso) return "";
  const now = new Date();
  const d = new Date(iso);
  const sameDay =
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate();
  return sameDay ? clockLabel(iso) : dayMonth(iso);
}

export function InboxClient({
  initialConversations,
  attendants,
  deals = [],
  materials = [],
}: {
  initialConversations: WaConversation[];
  attendants: Attendant[];
  deals?: { id: string; name: string; stage?: string }[];
  materials?: SalesMaterial[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [status, setStatus] = useState<WaStatus>("open");
  const [attendantFilter, setAttendantFilter] = useState<string>("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [selected, setSelected] = useState<WaConversation | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Anexa um material de venda à mensagem (insere link) e conta o envio.
  function attachMaterial(m: SalesMaterial) {
    const href = m.link || m.fileUrl || "";
    setText((t) => `${t}${t.trim() ? "\n" : ""}${m.title}${href && href !== "#" ? `: ${href}` : ""}`);
    setShowMaterials(false);
    fetch("/api/crm/sales-materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "use", id: m.id }),
    }).catch(() => {});
  }

  const filtered = conversations
    .filter((c) => c.status === status)
    .filter((c) => (attendantFilter ? c.assignedTo === attendantFilter : true))
    .filter((c) =>
      query
        ? conversationTitle(c).toLowerCase().includes(query.toLowerCase()) ||
          c.phone.includes(query.replace(/\D/g, ""))
        : true,
    );

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch(`/api/inbox/conversations?status=${status}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const json = await res.json();
        setConversations(json.conversations ?? []);
      }
    } catch {
      /* mantém estado atual */
    }
  }, [status]);

  const loadMessages = useCallback(async (id: string, read = false) => {
    try {
      const res = await fetch(
        `/api/inbox/messages?conversationId=${id}${read ? "&read=1" : ""}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const json = await res.json();
        setMessages(json.messages ?? []);
        setSelected(json.conversation ?? null);
      }
    } catch {
      /* ignora */
    }
  }, []);

  // Polling: lista a cada 6s; chat aberto a cada 4s.
  useEffect(() => {
    const t = setInterval(loadConversations, 6000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    const t = setInterval(() => loadMessages(selectedId), 4000);
    return () => clearInterval(t);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function openConversation(c: WaConversation) {
    setSelectedId(c.id);
    setSelected(c);
    setMessages([]);
    loadMessages(c.id, true);
    // zera o badge local
    setConversations((prev) =>
      prev.map((x) => (x.id === c.id ? { ...x, unreadCount: 0 } : x)),
    );
  }

  async function send() {
    if (!text.trim() || !selectedId || sending) return;
    setSending(true);
    const body = text.trim();
    setText("");
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${prev.length}`,
        conversationId: selectedId,
        direction: "out",
        type: "text",
        body,
        author: "Você",
        createdAt: new Date().toISOString(),
      },
    ]);
    await fetch("/api/inbox/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, text: body }),
    }).catch(() => {});
    setSending(false);
    loadConversations();
  }

  function mediaType(mime: string): "image" | "audio" | "video" | "document" {
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("audio/")) return "audio";
    if (mime.startsWith("video/")) return "video";
    return "document";
  }

  async function uploadAndSend(file: File, forceType?: "audio") {
    if (!selectedId) return;
    setUploading(true);
    try {
      const type = forceType ?? mediaType(file.type);
      const fd = new FormData();
      fd.append("file", file);
      fd.append("conversationId", selectedId);
      const up = await fetch("/api/inbox/upload", { method: "POST", body: fd });
      const upJson = await up.json();
      if (!up.ok) throw new Error(upJson.error ?? "upload falhou");

      setMessages((prev) => [
        ...prev,
        {
          id: `tmp-${prev.length}`,
          conversationId: selectedId,
          direction: "out",
          type,
          mediaUrl: upJson.url,
          author: "Você",
          createdAt: new Date().toISOString(),
        },
      ]);
      await fetch("/api/inbox/send-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedId,
          type,
          fileUrl: upJson.url,
          filename: file.name,
        }),
      });
      loadConversations();
    } catch {
      /* ignora */
    } finally {
      setUploading(false);
    }
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const ext = mime.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        if (blob.size > 0) {
          await uploadAndSend(new File([blob], `audio-${Date.now()}.${ext}`, { type: mime }), "audio");
        }
      };
      recorderRef.current = rec;
      rec.start();
      setRecording(true);
    } catch {
      alert("Não foi possível acessar o microfone.");
    }
  }

  async function assign(assignedTo: string | null) {
    if (!selectedId) return;
    setSelected((s) => (s ? { ...s, assignedTo: assignedTo ?? undefined, assignedName: attendants.find((a) => a.id === assignedTo)?.name } : s));
    await fetch("/api/inbox/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, assignedTo }),
    }).catch(() => {});
    loadConversations();
  }

  async function changeStatus(newStatus: WaStatus) {
    if (!selectedId) return;
    await fetch("/api/inbox/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: selectedId, status: newStatus }),
    }).catch(() => {});
    setSelected((s) => (s ? { ...s, status: newStatus } : s));
    loadConversations();
    if (newStatus !== status) setSelectedId(null);
  }

  // Contadores por atendente (controle de atendentes).
  const counts = attendants.map((a) => ({
    ...a,
    open: conversations.filter((c) => c.assignedTo === a.id && c.status !== "closed").length,
  }));
  const unassigned = conversations.filter((c) => !c.assignedTo && c.status !== "closed").length;

  return (
    <div className="flex h-[calc(100dvh-4rem-env(safe-area-inset-top))] overflow-hidden border-t border-line">
      {/* Coluna 1 — lista de conversas. No mobile alterna com o chat (esconde quando há conversa aberta). */}
      <aside
        className={cn(
          "w-full flex-col border-r border-line bg-surface lg:flex lg:w-80 lg:shrink-0",
          selected ? "hidden" : "flex",
        )}
      >
        <div className="border-b border-line p-3">
          <div className="mb-2 flex items-center gap-2">
            <MessagesSquare className="h-4 w-4 text-brand-600" />
            <h1 className="text-sm font-semibold text-ink">Atendimento</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar contato ou número"
              className="w-full rounded-lg border border-line bg-canvas py-1.5 pl-8 pr-2 text-sm text-ink outline-none focus:border-brand-400"
            />
          </div>
          <div data-tour="inbox-status" className="mt-2 flex gap-1">
            {WA_STATUS.map((s) => (
              <button
                key={s.key}
                onClick={() => {
                  setStatus(s.key);
                  setSelectedId(null);
                }}
                className={cn(
                  "flex-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
                  status === s.key ? "bg-brand-600 text-white" : "text-muted hover:bg-subtle",
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <select
            value={attendantFilter}
            onChange={(e) => setAttendantFilter(e.target.value)}
            className="mt-2 w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
          >
            <option value="">Todos os atendentes</option>
            {attendants.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {/* Canais (multicanal): WhatsApp ativo; IG/e-mail conectam via Integrações. */}
          <div className="mt-2 flex items-center gap-1">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> WhatsApp
            </span>
            <Link href="/gerencial/integracoes" className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted hover:bg-subtle-strong" title="Conectar Instagram em Integrações">
              Instagram <span className="text-[9px]">+ conectar</span>
            </Link>
            <Link href="/gerencial/integracoes" className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[10px] font-medium text-muted hover:bg-subtle-strong" title="Conectar e-mail em Integrações">
              E-mail <span className="text-[9px]">+ conectar</span>
            </Link>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted">
              Nenhuma conversa {WA_STATUS.find((s) => s.key === status)?.label.toLowerCase()}.
            </p>
          ) : (
            filtered.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-line px-3 py-3 text-left transition-colors hover:bg-canvas",
                  selectedId === c.id && "bg-canvas",
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-600">
                  {initials(conversationTitle(c))}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-ink">
                      {conversationTitle(c)}
                    </p>
                    <span className="shrink-0 text-[10px] text-muted">{stamp(c.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-xs text-muted">
                    {c.lastDirection === "out" && "Você: "}
                    {c.lastMessagePreview ?? formatPhone(c.phone)}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    {c.assignedName && (
                      <span className="rounded-full bg-subtle px-1.5 py-0.5 text-[10px] text-muted">
                        {c.assignedName}
                      </span>
                    )}
                    {c.unreadCount > 0 && (
                      <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] font-bold text-white">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* Coluna 2 — chat. No mobile só aparece quando há conversa selecionada. */}
      <section
        className={cn(
          "min-w-0 flex-1 flex-col bg-canvas lg:flex",
          selected ? "flex" : "hidden",
        )}
      >
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted">
            <MessagesSquare className="h-10 w-10 opacity-40" />
            <p className="text-sm">Selecione uma conversa para começar.</p>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  onClick={() => setSelectedId(null)}
                  aria-label="Voltar para conversas"
                  className="-ml-1 shrink-0 rounded-lg p-1 text-muted hover:bg-subtle lg:hidden"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-semibold text-emerald-600">
                  {initials(conversationTitle(selected))}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{conversationTitle(selected)}</p>
                  <p className="truncate text-xs text-muted">{formatPhone(selected.phone)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selected.leadId && (
                  <Link
                    href={`/gerencial/crm/${selected.leadId}`}
                    className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
                  >
                    Ver lead
                  </Link>
                )}
                <select
                  value={selected.status}
                  onChange={(e) => changeStatus(e.target.value as WaStatus)}
                  className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400"
                >
                  {WA_STATUS.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label.replace(/s$/, "")}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.direction === "out" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                      m.direction === "out"
                        ? "rounded-br-sm bg-emerald-600 text-white"
                        : "rounded-bl-sm bg-surface text-ink",
                    )}
                  >
                    <MessageBody m={m} />
                    <span
                      className={cn(
                        "mt-0.5 flex items-center justify-end gap-1 text-[10px]",
                        m.direction === "out" ? "text-white/70" : "text-muted",
                      )}
                    >
                      {clockLabel(m.createdAt)}
                      {m.direction === "out" &&
                        (m.status === "read" ? (
                          <CheckCheck className="h-3 w-3" />
                        ) : (
                          <Check className="h-3 w-3" />
                        ))}
                    </span>
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="py-8 text-center text-sm text-muted">Sem mensagens ainda.</p>
              )}
            </div>

            <div className="border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <input
                ref={fileRef}
                type="file"
                accept="image/*,audio/*,video/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadAndSend(file);
                  e.target.value = "";
                }}
              />
              <div className="flex items-end gap-2">
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading || recording}
                  title="Anexar arquivo"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:bg-subtle disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                </button>
                {materials.length > 0 && (
                  <div className="relative">
                    <button
                      onClick={() => setShowMaterials((s) => !s)}
                      disabled={recording}
                      title="Anexar material de venda"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:bg-subtle disabled:opacity-50"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                    {showMaterials && (
                      <div className="absolute bottom-12 left-0 z-30 max-h-72 w-72 overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-lg">
                        <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted">Materiais de venda</p>
                        {materials.map((m) => (
                          <button
                            key={m.id}
                            onClick={() => attachMaterial(m)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-black/5"
                          >
                            <span className="min-w-0 truncate">{m.title}</span>
                            <span className="shrink-0 text-[11px] text-muted">{m.usageCount}×</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  rows={1}
                  placeholder={recording ? "Gravando áudio…" : "Escreva uma mensagem…"}
                  disabled={recording}
                  className="max-h-32 flex-1 resize-none rounded-xl border border-line bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-brand-400 disabled:opacity-60"
                />
                {text.trim() ? (
                  <button
                    onClick={send}
                    disabled={sending}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                ) : (
                  <button
                    onClick={toggleRecording}
                    title={recording ? "Parar e enviar" : "Gravar áudio"}
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
                      recording ? "animate-pulse bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700",
                    )}
                  >
                    {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </section>

      {/* Coluna 3 — contato + controle de atendentes */}
      <aside className="hidden w-72 shrink-0 flex-col border-l border-line bg-surface xl:flex">
        {selected ? (
          <div className="space-y-4 p-4">
            <div className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-xl font-semibold text-emerald-600">
                {initials(conversationTitle(selected))}
              </span>
              <p className="mt-2 text-sm font-semibold text-ink">{conversationTitle(selected)}</p>
              <p className="text-xs text-muted">{formatPhone(selected.phone)}</p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted">Atendente responsável</p>
              <select
                value={selected.assignedTo ?? ""}
                onChange={(e) => assign(e.target.value || null)}
                className="w-full rounded-lg border border-line bg-canvas px-2 py-2 text-sm text-ink outline-none focus:border-brand-400"
              >
                <option value="">Sem atendente</option>
                {attendants.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <InboxLeadPanel
              conversation={selected}
              deals={deals}
              onLinked={(leadId) => {
                setSelected((s) => (s ? { ...s, leadId } : s));
                setConversations((prev) => prev.map((x) => (x.id === selected.id ? { ...x, leadId } : x)));
              }}
            />
          </div>
        ) : (
          <div className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-ink">Controle de atendentes</h2>
            </div>
            <div className="space-y-1.5">
              {counts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setAttendantFilter((cur) => (cur === a.id ? "" : a.id))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    attendantFilter === a.id ? "bg-brand-50 text-brand-700" : "hover:bg-subtle",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-600">
                      {initials(a.name)}
                    </span>
                    <span className="text-ink">{a.name}</span>
                  </span>
                  <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-muted">
                    {a.open}
                  </span>
                </button>
              ))}
              <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm">
                <span className="text-muted">Sem atendente</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                  {unassigned}
                </span>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
