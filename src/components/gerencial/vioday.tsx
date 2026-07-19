"use client";

import { useMemo, useState } from "react";
import {
  CalendarClock,
  Camera,
  CheckCircle2,
  Clapperboard,
  Film,
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

const FOOTAGE_LABEL: Record<FootageStatus, string> = Object.fromEntries(
  FOOTAGE_STAGES.map((f) => [f.key, f.label]),
) as Record<FootageStatus, string>;

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
  const [link, setLink] = useState("");
  const persistable = !!p.id;

  function setCapture(status: CaptureStatus) {
    setSt((s) => ({ ...s, captureStatus: status }));
    if (persistable) {
      void post({ action: "set-capture", clientId, postId: p.id, taskId: p.taskId, status });
    }
  }

  function addRaw() {
    const url = link.trim();
    if (!url) return;
    setSt((s) => ({ ...s, rawAssets: [...s.rawAssets, url], footageStatus: "raw_delivered" }));
    setLink("");
    if (persistable) {
      void post({ action: "add-raw", clientId, postId: p.id, taskId: p.taskId, url });
    }
  }

  function setFootage(status: FootageStatus) {
    setSt((s) => ({ ...s, footageStatus: status }));
    if (persistable) {
      void post({ action: "set-footage", clientId, postId: p.id, taskId: p.taskId, status });
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{p.title}</p>
          <p className="text-xs text-muted">
            {p.format} · {p.pillar} · ref: {p.references.length}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", CAPTURE[st.captureStatus].chip)}>
          {CAPTURE[st.captureStatus].label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => setCapture("done")}
          className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium", st.captureStatus === "done" ? "bg-emerald-600 text-white" : "border border-line text-ink hover:bg-subtle")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Capturado
        </button>
        <button
          onClick={() => setCapture("reshoot")}
          className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium", st.captureStatus === "reshoot" ? "bg-rose-600 text-white" : "border border-line text-ink hover:bg-subtle")}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Refazer
        </button>
        {st.captureStatus !== "pending" && (
          <button onClick={() => setCapture("pending")} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-subtle">limpar</button>
        )}
      </div>

      {st.captureStatus === "done" && (
        <div className="mt-2 rounded-lg bg-emerald-500/5 p-2">
          <p className="mb-1 text-[11px] text-emerald-600">
            ✔ Task da LE avançou de estágio · brutos liberados para o editor.
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {st.rawAssets.map((r, i) => (
              <a key={i} href={r} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[10px] text-ink hover:bg-subtle-strong">
                <Film className="h-3 w-3" /> bruto {i + 1}
              </a>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link dos brutos (drive, frame.io…)"
              className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400"
            />
            <button
              onClick={addRaw}
              className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Progressão de pós-produção por item */}
          <div className="mt-2 flex flex-wrap gap-1">
            {FOOTAGE_STAGES.map((f) => (
              <button
                key={f.key}
                onClick={() => setFootage(f.key)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  st.footageStatus === f.key ? "bg-brand-600 text-white" : "border border-line text-muted hover:text-ink",
                )}
              >
                {f.key === "raw_delivered" && <Link2 className="h-3 w-3" />}
                {f.label}
              </button>
            ))}
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Clapperboard className="h-5 w-5 text-brand-500" />
        <div>
          <h2 className="text-sm font-semibold text-ink">VioDay — Media Day de {editorial.clientName}</h2>
          <p className="text-xs text-muted">Planejar → capturar → entregar. Checklist alimentado pela Linha Editorial.</p>
        </div>
      </div>

      {/* Fase 1 — Planejamento */}
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

      {/* Fase 2 — Captura (checklist automático) */}
      <Card className="p-5">
        <div className="mb-1 flex items-center gap-2">
          <Camera className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-ink">2 · Captura</h3>
        </div>
        <p className="mb-3 text-xs text-muted">
          {items.length} item(ns) — alimentados automaticamente pelos posts com direcionamento &quot;Media Day&quot;.
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

      {/* Fase 3 — Pós / entrega (resumo) */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Film className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-ink">3 · Pós / entrega</h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-muted">
          {FOOTAGE_STAGES.map((f) => {
            const n = items.filter((p) => (p.id && stateByPost.get(p.id)?.footageStatus) === f.key).length;
            return (
              <span key={f.key} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1">
                <span className="font-semibold text-ink">{n}</span> {FOOTAGE_LABEL[f.key]}
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted">
          Marcar &quot;Capturado&quot; avança a task na LE e libera os brutos ao editor. A progressão de pós (brutos → edição → final) é feita em cada item acima.
        </p>
      </Card>
    </div>
  );
}
