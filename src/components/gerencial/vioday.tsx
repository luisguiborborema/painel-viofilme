"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clapperboard,
  Film,
  ImageIcon,
  Link2,
  Plus,
  RotateCcw,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  FOOTAGE_STAGES,
  type CaptureStatus,
  type EditorialLine,
  type EditorialPost,
  type EditorialRef,
  type FootageStatus,
  type MediaDayItemState,
  type MediaDaySession,
  type MediaDayView,
} from "@/lib/data/operacao";

const CAPTURE: Record<CaptureStatus, { label: string; chip: string }> = {
  pending: { label: "Pendente", chip: "bg-subtle text-muted" },
  done: { label: "Capturado", chip: "bg-emerald-500/15 text-emerald-600" },
  reshoot: { label: "Refazer", chip: "bg-rose-500/15 text-rose-500" },
};

const EMPTY_STATE: Omit<MediaDayItemState, "postId" | "taskId"> = {
  captureStatus: "pending",
  footageStatus: "awaiting",
  rawAssets: [],
};

async function post(body: Record<string, unknown>) {
  const res = await fetch("/api/gerencial/mediaday", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

// Referência do moodboard do post (VD02) — lida da LE, nunca copiada.
function RefChip({ r }: { r: EditorialRef }) {
  const label = r.label || r.kind;
  if (!r.url) {
    return <span className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 text-[11px] text-muted"><ImageIcon className="h-3 w-3" /> {label}</span>;
  }
  return (
    <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-subtle px-2 py-1 text-[11px] text-ink hover:bg-subtle-strong">
      <ImageIcon className="h-3 w-3" /> {label}
    </a>
  );
}

function CaptureItem({
  clientId,
  post: p,
  state,
}: {
  clientId: string;
  post: EditorialPost;
  state: MediaDayItemState;
}) {
  const [st, setSt] = useState<MediaDayItemState>(state);
  const [open, setOpen] = useState(false);
  const [link, setLink] = useState("");
  const persistable = !!p.id;
  const refCount = p.references.length;

  function setCapture(status: CaptureStatus) {
    setSt((s) => ({ ...s, captureStatus: status }));
    if (persistable) {
      void post({ action: "set-capture", clientId, postId: p.id, taskId: p.taskId, status });
    }
  }

  function addRaw() {
    const url = link.trim();
    if (!url) return;
    setSt((s) => ({ ...s, rawAssets: [...s.rawAssets, url] }));
    setLink("");
    if (persistable) {
      void post({ action: "add-raw", clientId, postId: p.id, taskId: p.taskId, url });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface">
      {/* Cabeçalho do item — clicável para expandir o roteiro (VD02) */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-2 p-3 text-left"
      >
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{p.title}</p>
          <p className="text-xs text-muted">
            {p.format} · {p.pillar}
            {refCount > 0 && <span> · {refCount} ref{refCount > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", CAPTURE[st.captureStatus].chip)}>
            {CAPTURE[st.captureStatus].label}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} />
        </div>
      </button>

      {/* Roteiro + referência inline — o fotógrafo vê sem sair da tela (VD02/VD05) */}
      {open && (
        <div className="border-t border-line px-3 py-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">Roteiro</p>
          <p className="whitespace-pre-wrap text-sm text-ink">{p.description || "—"}</p>
          {refCount > 0 && (
            <>
              <p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Referência</p>
              <div className="flex flex-wrap gap-1.5">
                {p.references.map((r) => <RefChip key={r.id} r={r} />)}
              </div>
            </>
          )}
        </div>
      )}

      {/* Botões grandes e tocáveis (VD00 — mobile-friendly) */}
      <div className="flex flex-wrap gap-2 border-t border-line p-3">
        <button
          onClick={() => setCapture("done")}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold",
            st.captureStatus === "done" ? "bg-emerald-600 text-white" : "border border-line text-ink hover:bg-subtle",
          )}
        >
          <CheckCircle2 className="h-4 w-4" /> Capturado
        </button>
        <button
          onClick={() => setCapture("reshoot")}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-semibold",
            st.captureStatus === "reshoot" ? "bg-rose-600 text-white" : "border border-line text-ink hover:bg-subtle",
          )}
        >
          <RotateCcw className="h-4 w-4" /> Refazer
        </button>
        {st.captureStatus !== "pending" && (
          <button onClick={() => setCapture("pending")} className="rounded-lg px-3 py-2.5 text-xs text-muted hover:bg-subtle">limpar</button>
        )}
      </div>

      {/* Brutos liberados ao editor no "capturado" (VD02.1) */}
      {st.captureStatus === "done" && (
        <div className="border-t border-line bg-emerald-500/5 p-3">
          <p className="mb-1.5 text-[11px] text-emerald-600">✔ Task da LE avançou · brutos liberados para o editor.</p>
          {st.rawAssets.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {st.rawAssets.map((r, i) => (
                <a key={i} href={r} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[10px] text-ink hover:bg-subtle-strong">
                  <Film className="h-3 w-3" /> bruto {i + 1}
                </a>
              ))}
            </div>
          )}
          <div className="flex gap-1.5">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link dos brutos (drive, frame.io…)"
              className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-xs text-ink outline-none focus:border-brand-400"
            />
            <button onClick={addRaw} className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-700">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VioDay({
  clientId,
  editorial,
  initial = { session: null, items: [] },
}: {
  clientId: string;
  editorial: EditorialLine;
  initial?: MediaDayView;
}) {
  const items = useMemo(
    () => editorial.posts.filter((p) => p.artDirection === "Media Day"),
    [editorial.posts],
  );
  const stateByPost = useMemo(() => {
    const m = new Map<string, MediaDayItemState>();
    for (const it of initial.items) m.set(it.postId, it);
    return m;
  }, [initial.items]);

  const [plan, setPlan] = useState<MediaDaySession>(
    initial.session ?? {
      scheduledLabel: "",
      location: "",
      team: "",
      equipment: "",
      notes: "",
      status: "planning",
      postStatus: "awaiting",
    },
  );

  function savePlan(next: MediaDaySession) {
    void post({
      action: "save-plan",
      clientId,
      scheduledLabel: next.scheduledLabel,
      location: next.location,
      team: next.team,
      equipment: next.equipment,
      notes: next.notes,
      status: next.status,
    });
  }

  function setPostStatus(status: FootageStatus) {
    setPlan((p) => ({ ...p, postStatus: status }));
    void post({ action: "set-post-status", clientId, status });
  }

  const postIdx = FOOTAGE_STAGES.findIndex((f) => f.key === plan.postStatus);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-5 w-5 text-brand-500" />
        <div>
          <h2 className="text-sm font-semibold text-ink">VioDay — Media Day de {editorial.clientName}</h2>
          <p className="text-xs text-muted">Planejar → capturar → entregar. Checklist alimentado pela Linha Editorial.</p>
        </div>
      </div>

      {/* Fase 1 — Planejamento (desktop) */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-ink">1 · Planejamento</h3>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {([
            ["scheduledLabel", "Data & horário"],
            ["location", "Locação"],
            ["team", "Equipe"],
            ["equipment", "Equipamento"],
          ] as const).map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
              <input
                value={plan[k]}
                onChange={(e) => setPlan((p) => ({ ...p, [k]: e.target.value }))}
                onBlur={() => savePlan(plan)}
                placeholder="—"
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Anotações gerais</span>
            <textarea
              value={plan.notes}
              onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))}
              onBlur={() => savePlan(plan)}
              rows={2}
              className="w-full resize-none rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
            />
          </label>
        </div>
      </Card>

      {/* Fase 2 — Captura (mobile-friendly, itens da LE) */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Camera className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-ink">2 · Captura</h3>
        </div>
        <p className="mb-3 text-xs text-muted">
          {items.length} item(ns) — alimentados automaticamente pelos posts com direcionamento &quot;Media Day&quot;. Toque para ver o roteiro.
        </p>
        {items.length === 0 ? (
          <p className="rounded-lg bg-subtle px-3 py-6 text-center text-sm text-muted">
            Nenhum post marcado como &quot;Media Day&quot; na Linha Editorial. Defina o direcionamento de arte na LE para popular aqui.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((p) => (
              <CaptureItem
                key={p.id ?? p.n}
                clientId={clientId}
                post={p}
                state={
                  (p.id && stateByPost.get(p.id)) || {
                    postId: p.id ?? String(p.n),
                    taskId: p.taskId,
                    ...EMPTY_STATE,
                  }
                }
              />
            ))}
          </div>
        )}
      </Card>

      {/* Fase 3 — Pós / entrega (estado GLOBAL do dia, VD03) */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Film className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-ink">3 · Pós / entrega</h3>
        </div>
        {/* Barra de progresso do dia */}
        <div className="mb-3 h-2 overflow-hidden rounded-full bg-subtle-strong">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${((postIdx + 1) / FOOTAGE_STAGES.length) * 100}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FOOTAGE_STAGES.map((f, i) => (
            <button
              key={f.key}
              onClick={() => setPostStatus(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                plan.postStatus === f.key
                  ? "bg-brand-600 text-white"
                  : i <= postIdx
                    ? "bg-brand-500/15 text-brand-600"
                    : "border border-line text-muted hover:text-ink",
              )}
            >
              {f.key === "raw_delivered" && <Link2 className="h-3.5 w-3.5" />}
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Estado do material da diária inteira. Marcar &quot;Capturado&quot; num item avança a task na LE e libera os brutos ao editor.
        </p>
      </Card>
    </div>
  );
}
