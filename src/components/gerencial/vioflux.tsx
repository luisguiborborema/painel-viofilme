"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Camera,
  Globe,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  Plus,
  Send,
  Sparkles,
  SquareStack,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { clockLabel, dayMonth } from "@/lib/datetime";
import {
  FLUX_POSTS,
  FLUX_STATES,
  stateMeta,
  type FluxNetwork,
  type FluxPost,
  type FluxState,
} from "@/lib/data/flux";
import type { EditorialFormat } from "@/lib/data/operacao";

type ClientOpt = { id: string; name: string };
type View = "dashboard" | "calendario" | "posts" | "aprovacao" | "criar";
type Scope = "meus" | "squad" | "todos";

const VIEWS: { key: View; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "posts", label: "Posts", icon: SquareStack },
  { key: "aprovacao", label: "Grupo de aprovação", icon: Send },
  { key: "criar", label: "Criar post", icon: Plus },
];

const NET_ICON: Record<FluxNetwork, typeof Camera> = { instagram: Camera, facebook: Globe };
let seq = 9000;

async function postVioflux(body: Record<string, unknown>) {
  const res = await fetch("/api/gerencial/vioflux", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return res?.ok ? res.json().catch(() => ({})) : null;
}

// Traduz um patch de estado do ciclo (FLX04.2) na ação de API correspondente.
function persistPatch(id: string, patch: Partial<FluxPost>) {
  if (patch.state === "ajuste") {
    void postVioflux({ action: "request-change", id, comment: patch.clientComment ?? "" });
  } else if (patch.state === "agendado" && patch.scheduledAt) {
    void postVioflux({ action: "schedule", id, scheduledAt: patch.scheduledAt });
  } else if (patch.state) {
    void postVioflux({ action: "set-state", id, state: patch.state });
  }
}

function NetIcons({ nets }: { nets: FluxNetwork[] }) {
  return (
    <span className="flex items-center gap-1">
      {nets.map((n) => {
        const Icon = NET_ICON[n];
        return <Icon key={n} className="h-3.5 w-3.5 text-muted" />;
      })}
    </span>
  );
}

export function VioFlux({
  clients,
  myClientIds,
  initialPosts = FLUX_POSTS,
}: {
  clients: ClientOpt[];
  myClientIds: string[];
  initialPosts?: FluxPost[];
}) {
  const [posts, setPosts] = useState<FluxPost[]>(initialPosts);
  const [view, setView] = useState<View>("dashboard");
  const [scope, setScope] = useState<Scope>("squad");
  const [clientId, setClientId] = useState<string>("");
  const [selected, setSelected] = useState<FluxPost | null>(null);
  const mine = useMemo(() => new Set(myClientIds), [myClientIds]);

  const visible = posts.filter(
    (p) => (scope !== "meus" || mine.has(p.clientId)) && (!clientId || p.clientId === clientId),
  );

  function update(id: string, patch: Partial<FluxPost>) {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSelected((s) => (s && s.id === id ? { ...s, ...patch } : s));
    persistPatch(id, patch);
  }

  return (
    <div className="space-y-4">
      {/* Barra: projeto/cliente + escopo */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400">
          <option value="">Todos os projetos</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <div className="inline-flex rounded-xl border border-line bg-surface p-0.5">
          {(["meus", "squad", "todos"] as const).map((s) => (
            <button key={s} onClick={() => setScope(s)} className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize", scope === s ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>{s}</button>
          ))}
        </div>
        <span className="text-xs text-muted">{visible.length} post(s)</span>
      </div>

      {/* Tabs de visão */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-line bg-surface p-1">
        {VIEWS.map((v) => {
          const Icon = v.icon;
          return (
            <button key={v.key} onClick={() => setView(v.key)} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium", view === v.key ? "bg-subtle text-ink" : "text-muted hover:text-ink")}>
              <Icon className="h-4 w-4" /> {v.label}
            </button>
          );
        })}
      </div>

      {view === "dashboard" && <Dashboard posts={visible} onOpen={setSelected} />}
      {view === "calendario" && <Calendario posts={visible} onOpen={setSelected} />}
      {view === "posts" && <Board posts={visible} onOpen={setSelected} />}
      {view === "aprovacao" && (
        <GrupoAprovacao
          posts={visible}
          onSend={(ids) => {
            setPosts((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, state: "aguardando" } : p)));
            ids.forEach((id) => void postVioflux({ action: "set-state", id, state: "aguardando" }));
          }}
        />
      )}
      {view === "criar" && (
        <Criar
          clients={clients}
          defaultClient={clientId}
          onCreate={async (p, extra) => {
            const res = await postVioflux({ action: "create", ...extra });
            const id = (res && (res as { id?: string }).id) || p.id;
            setPosts((prev) => [{ ...p, id }, ...prev]);
            setView("posts");
          }}
        />
      )}

      {selected && <PostModal post={selected} onClose={() => setSelected(null)} onUpdate={update} />}
    </div>
  );
}

// --- Dashboard ---------------------------------------------------------------
function Dashboard({ posts, onOpen }: { posts: FluxPost[]; onOpen: (p: FluxPost) => void }) {
  const count = (s: FluxState) => posts.filter((p) => p.state === s).length;
  const upcoming = posts.filter((p) => p.state === "agendado").sort((a, b) => (a.scheduledAt ?? "").localeCompare(b.scheduledAt ?? ""));
  const ajustes = posts.filter((p) => p.state === "ajuste");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {FLUX_STATES.map((s) => (
          <Card key={s.key} className="p-3 text-center">
            <p className="text-2xl font-bold text-ink">{count(s.key)}</p>
            <p className="text-[10px] text-muted">{s.label}</p>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Próximos agendados</h3>
          {upcoming.length === 0 ? <p className="text-sm text-muted">Nada agendado.</p> : (
            <ul className="space-y-2">
              {upcoming.map((p) => (
                <li key={p.id}><button onClick={() => onOpen(p)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-subtle">
                  <span className="min-w-0"><span className="block truncate text-sm text-ink">{p.title}</span><span className="text-xs text-muted">{p.client}</span></span>
                  <span className="shrink-0 text-xs font-medium text-sky-500">{p.scheduledAt ? `${dayMonth(p.scheduledAt)} ${clockLabel(p.scheduledAt)}` : "—"}</span>
                </button></li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="border-l-4 border-l-rose-400 p-5">
          <h3 className="mb-3 text-sm font-semibold text-ink">Em ajuste (voltaram do cliente)</h3>
          {ajustes.length === 0 ? <p className="text-sm text-muted">Nenhum ajuste pendente.</p> : (
            <ul className="space-y-2">
              {ajustes.map((p) => (
                <li key={p.id}><button onClick={() => onOpen(p)} className="w-full rounded-lg bg-rose-500/5 px-3 py-2 text-left hover:bg-rose-500/10">
                  <span className="block text-sm font-medium text-ink">{p.title}</span>
                  <span className="text-xs text-rose-500">“{p.clientComment}”</span>
                </button></li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

// --- Board (posts por estado) ------------------------------------------------
function Board({ posts, onOpen }: { posts: FluxPost[]; onOpen: (p: FluxPost) => void }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {FLUX_STATES.map((s) => {
        const col = posts.filter((p) => p.state === s.key);
        return (
          <div key={s.key} className="w-[220px] shrink-0 rounded-2xl bg-subtle p-2.5">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink"><span className={cn("h-2 w-2 rounded-full", s.dot)} /> {s.label}</span>
              <span className="text-xs text-muted">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((p) => <PostCard key={p.id} post={p} onOpen={onOpen} />)}
              {col.length === 0 && <p className="px-1 py-3 text-center text-[11px] text-muted">—</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostCard({ post, onOpen }: { post: FluxPost; onOpen: (p: FluxPost) => void }) {
  return (
    <button onClick={() => onOpen(post)} className="w-full rounded-xl border border-line bg-surface p-3 text-left hover:shadow-sm">
      <p className="text-[11px] text-muted">{post.client}</p>
      <p className="mt-0.5 text-sm font-medium text-ink">{post.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <span className="rounded-full bg-subtle-strong px-2 py-0.5 text-[10px] font-medium text-muted">{post.format}</span>
        <NetIcons nets={post.networks} />
      </div>
      {post.scheduledAt && <p className="mt-1.5 text-[10px] text-sky-500">{dayMonth(post.scheduledAt)} {clockLabel(post.scheduledAt)}</p>}
    </button>
  );
}

// --- Calendário --------------------------------------------------------------
const WD = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function Calendario({ posts, onOpen }: { posts: FluxPost[]; onOpen: (p: FluxPost) => void }) {
  const [mode, setMode] = useState<"semana" | "mes">("semana");
  const when = (p: FluxPost) => p.scheduledAt ?? p.date;

  if (mode === "semana") {
    const cols = [1, 2, 3, 4, 5]; // Seg-Sex
    return (
      <div>
        <ModeToggle mode={mode} setMode={setMode} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {cols.map((dow) => {
            const day = posts.filter((p) => new Date(when(p)).getUTCDay() === dow);
            return (
              <div key={dow} className="rounded-2xl border border-line bg-surface p-2.5">
                <p className="mb-2 px-1 text-sm font-semibold text-ink">{WD[dow]}</p>
                <div className="space-y-2">
                  {day.map((p) => <CalChip key={p.id} post={p} onOpen={onOpen} />)}
                  {day.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mês
  const ref = new Date(when(posts[0]) ?? new Date().toISOString());
  const y = ref.getUTCFullYear(), mo = ref.getUTCMonth();
  const first = new Date(Date.UTC(y, mo, 1));
  const cells: (number | null)[] = [];
  for (let i = 0; i < first.getUTCDay(); i++) cells.push(null);
  for (let d = 1; d <= new Date(Date.UTC(y, mo + 1, 0)).getUTCDate(); d++) cells.push(d);
  const on = (d: number) => posts.filter((p) => { const x = new Date(when(p)); return x.getUTCFullYear() === y && x.getUTCMonth() === mo && x.getUTCDate() === d; });

  return (
    <div>
      <ModeToggle mode={mode} setMode={setMode} />
      <Card className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted">{WD.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => (
            <div key={i} className="min-h-[64px] rounded-lg border border-line p-1">
              {d && <p className="px-1 text-[10px] text-muted">{d}</p>}
              <div className="space-y-0.5">
                {(d ? on(d) : []).slice(0, 3).map((p) => (
                  <button key={p.id} onClick={() => onOpen(p)} className={cn("block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium", stateMeta(p.state).chip)}>{p.title}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: "semana" | "mes"; setMode: (m: "semana" | "mes") => void }) {
  return (
    <div className="mb-3 inline-flex rounded-lg border border-line bg-surface p-0.5">
      {(["semana", "mes"] as const).map((m) => (
        <button key={m} onClick={() => setMode(m)} className={cn("rounded-md px-3 py-1 text-xs font-medium", mode === m ? "bg-brand-600 text-white" : "text-muted hover:text-ink")}>{m === "semana" ? "Semana" : "Mês"}</button>
      ))}
    </div>
  );
}

function CalChip({ post, onOpen }: { post: FluxPost; onOpen: (p: FluxPost) => void }) {
  return (
    <button onClick={() => onOpen(post)} className="w-full rounded-lg border-l-2 bg-surface px-2 py-1.5 text-left" style={{ borderLeftColor: "transparent" }}>
      <span className={cn("mb-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold", stateMeta(post.state).chip)}>{stateMeta(post.state).label}</span>
      <span className="block truncate text-xs font-medium text-ink">{post.title}</span>
      <span className="text-[10px] text-muted">{clockLabel(post.scheduledAt ?? post.date)}</span>
    </button>
  );
}

// --- Grupo de aprovação ------------------------------------------------------
function GrupoAprovacao({ posts, onSend }: { posts: FluxPost[]; onSend: (ids: string[]) => void }) {
  const candidates = posts.filter((p) => p.state === "rascunho" || p.state === "ajuste");
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) => setSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-semibold text-ink">Grupo de aprovação</h3>
      <p className="mb-3 text-xs text-muted">Selecione os posts prontos e envie em conjunto — eles aparecem no Painel do Cliente para aprovação.</p>
      {candidates.length === 0 ? (
        <p className="rounded-lg bg-subtle px-3 py-6 text-center text-sm text-muted">Nada pronto para enviar. (rascunhos e ajustes aparecem aqui)</p>
      ) : (
        <>
          <ul className="divide-y divide-line">
            {candidates.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <input type="checkbox" checked={sel.includes(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 rounded border-line" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-ink">{p.title}</p><p className="text-xs text-muted">{p.client} · {stateMeta(p.state).label}</p></div>
                <NetIcons nets={p.networks} />
              </li>
            ))}
          </ul>
          <button onClick={() => { if (sel.length) { onSend(sel); setSel([]); } }} disabled={sel.length === 0} className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            <Send className="h-4 w-4" /> Enviar {sel.length || ""} para aprovação
          </button>
        </>
      )}
    </Card>
  );
}

// --- Criar post --------------------------------------------------------------
const FORMATS: EditorialFormat[] = ["Feed", "Reels", "Stories", "Carrossel"];
function Criar({ clients, defaultClient, onCreate }: { clients: ClientOpt[]; defaultClient: string; onCreate: (p: FluxPost, extra: Record<string, unknown>) => void }) {
  const [clientId, setClientId] = useState(defaultClient || clients[0]?.id || "");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [format, setFormat] = useState<EditorialFormat>("Feed");
  const [nets, setNets] = useState<FluxNetwork[]>(["instagram"]);
  const [dest, setDest] = useState<"aprovacao" | "agendar" | "publicar">("aprovacao");
  const [when, setWhen] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  function toggleNet(n: FluxNetwork) { setNets((p) => (p.includes(n) ? p.filter((x) => x !== n) : [...p, n])); }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/gerencial/task-upload", { method: "POST", body: form }).catch(() => null);
    if (res?.ok) {
      const j = await res.json();
      if (j.url) setMediaUrl(j.url);
    }
    setUploading(false);
  }

  function submit() {
    if (!title.trim() || !clientId) return;
    const client = clients.find((c) => c.id === clientId)?.name ?? "Cliente";
    const state: FluxState = dest === "aprovacao" ? "aguardando" : dest === "agendar" ? "agendado" : "publicado";
    const nowIso = new Date().toISOString();
    const scheduledAt = dest !== "aprovacao" && when ? new Date(when).toISOString() : undefined;
    onCreate(
      {
        id: `fx-${seq++}`, taskId: `new-${seq}`, clientId, client, title: title.trim(), caption: caption.trim(),
        format, networks: nets, state, date: when ? new Date(when).toISOString() : nowIso,
        scheduledAt, mediaNote: mediaUrl ? "Mídia anexada" : "Sem mídia", mediaUrl: mediaUrl || undefined,
      },
      { clientId, title: title.trim(), caption: caption.trim(), format, networks: nets, state, scheduledAt, mediaUrl: mediaUrl || undefined },
    );
  }

  const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";
  return (
    <Card className="max-w-xl space-y-3 p-5">
      <h3 className="text-sm font-semibold text-ink">Criar post</h3>
      {/* Área de mídia — upload real (bucket público, pré-requisito de publicação IG) */}
      <div className="rounded-lg border border-dashed border-line p-4 text-center">
        {mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl} alt="Prévia" className="mx-auto max-h-48 rounded-lg object-contain" />
        ) : (
          <p className="mb-2 text-xs text-muted">Anexe imagem/vídeo do post</p>
        )}
        <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {mediaUrl ? "Trocar mídia" : "Anexar mídia"}
          <input type="file" accept="image/*,video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título do post" className={inputCls} />
      <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} placeholder="Legenda…" className={cn(inputCls, "resize-none")} />
      <div className="flex flex-wrap gap-1.5">
        {FORMATS.map((f) => <button key={f} onClick={() => setFormat(f)} className={cn("rounded-full px-3 py-1 text-xs font-medium", format === f ? "bg-ink text-surface" : "border border-line text-muted hover:text-ink")}>{f}</button>)}
      </div>
      <div className="flex gap-2">
        {(["instagram", "facebook"] as const).map((n) => {
          const Icon = NET_ICON[n]; const on = nets.includes(n);
          return <button key={n} onClick={() => toggleNet(n)} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium capitalize", on ? "border-brand-400 bg-brand-50 text-brand-700" : "border-line text-muted")}><Icon className="h-4 w-4" /> {n}</button>;
        })}
      </div>
      <div>
        <p className="mb-1 text-xs font-medium text-muted">Destino</p>
        <div className="flex flex-wrap gap-1.5">
          {([["aprovacao", "Enviar para aprovação"], ["agendar", "Agendar"], ["publicar", "Publicar (marcar)"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setDest(k)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", dest === k ? "bg-brand-600 text-white" : "border border-line text-muted hover:text-ink")}>{l}</button>
          ))}
        </div>
        {dest !== "aprovacao" && <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={cn(inputCls, "mt-2")} />}
      </div>
      <button onClick={submit} disabled={!title.trim()} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"><Plus className="h-4 w-4" /> Criar post</button>
    </Card>
  );
}

// --- Modal do post (ciclo manual) --------------------------------------------
function PostModal({ post, onClose, onUpdate }: { post: FluxPost; onClose: () => void; onUpdate: (id: string, patch: Partial<FluxPost>) => void }) {
  const [when, setWhen] = useState("");
  const [comment, setComment] = useState("");
  const [asking, setAsking] = useState(false);
  const st = stateMeta(post.state);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div>
            <p className="text-xs text-muted">{post.client}</p>
            <h2 className="text-base font-bold text-ink">{post.title}</h2>
            <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", st.chip)}>{st.label}</span>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">{post.format}</span>
            <NetIcons nets={post.networks} />
          </div>
          {post.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.mediaUrl} alt={post.title} className="max-h-56 w-full rounded-lg object-contain" />
          )}
          <p className="rounded-lg bg-canvas p-3 text-sm text-ink/90">{post.caption}</p>
          <p className="text-xs text-muted">Mídia: {post.mediaNote}</p>
          {post.scheduledAt && <p className="text-xs text-sky-500">Agendado (espelho): {dayMonth(post.scheduledAt)} {clockLabel(post.scheduledAt)}</p>}
          {post.clientComment && (
            <div className="rounded-lg bg-rose-500/5 p-3">
              <p className="text-[11px] font-semibold text-rose-500">Ajuste pedido pelo cliente</p>
              <p className="text-sm text-ink/90">“{post.clientComment}”</p>
            </div>
          )}

          {/* Ações do ciclo (manual) */}
          <div className="space-y-2 border-t border-line pt-3">
            {(post.state === "rascunho" || post.state === "ajuste") && (
              <button onClick={() => onUpdate(post.id, { state: "aguardando", clientComment: undefined })} className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Enviar para aprovação</button>
            )}
            {post.state === "aguardando" && (
              <>
                <p className="text-[11px] text-muted">O cliente responde no Portal. Se preciso, registre a resposta manualmente:</p>
                <div className="flex gap-2">
                  <button onClick={() => onUpdate(post.id, { state: "aprovado" })} className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Aprovar</button>
                  <button onClick={() => setAsking((a) => !a)} className="flex-1 rounded-xl border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">Pedir ajuste</button>
                </div>
                {asking && (
                  <div className="flex gap-1.5">
                    <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário do cliente…" className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400" />
                    <button onClick={() => comment.trim() && onUpdate(post.id, { state: "ajuste", clientComment: comment.trim() })} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">Enviar</button>
                  </div>
                )}
              </>
            )}
            {post.state === "aprovado" && (
              <>
                <p className="text-[11px] text-muted">Agende no agendador nativo do Meta e registre aqui (espelho — não publica):</p>
                <div className="flex gap-1.5">
                  <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400" />
                  <button onClick={() => when && onUpdate(post.id, { state: "agendado", scheduledAt: new Date(when).toISOString(), date: new Date(when).toISOString() })} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white">Agendar</button>
                </div>
                <button onClick={() => onUpdate(post.id, { state: "publicado" })} className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Marcar como publicado</button>
              </>
            )}
            {post.state === "agendado" && (
              <button onClick={() => onUpdate(post.id, { state: "publicado" })} className="w-full rounded-xl bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700">Marcar como publicado</button>
            )}
            {post.state === "publicado" && (
              <p className="flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Publicado — task fechada. Métricas serão lidas pela integração Meta.</p>
            )}
          </div>

          <p className="rounded-lg bg-subtle px-3 py-2 text-[11px] text-muted">
            <Sparkles className="mr-1 inline h-3 w-3" />
            Modo manual: o agendamento é espelho (não publica) e &quot;Publicado&quot; é marcado à mão. A automação liga quando a App Review da Meta passar.
          </p>
        </div>
      </div>
    </div>
  );
}
