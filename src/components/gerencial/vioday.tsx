"use client";

import { useState } from "react";
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
import type { EditorialLine, EditorialPost } from "@/lib/data/operacao";

type CaptureStatus = "pending" | "done" | "reshoot";
type FootageStatus = "awaiting" | "raw_delivered" | "editing" | "final";

const CAPTURE: Record<CaptureStatus, { label: string; chip: string }> = {
  pending: { label: "Pendente", chip: "bg-subtle text-muted" },
  done: { label: "Capturado", chip: "bg-emerald-500/15 text-emerald-600" },
  reshoot: { label: "Refazer", chip: "bg-rose-500/15 text-rose-500" },
};

const FOOTAGE: { key: FootageStatus; label: string }[] = [
  { key: "awaiting", label: "Aguardando captação" },
  { key: "raw_delivered", label: "Brutos entregues" },
  { key: "editing", label: "Em edição" },
  { key: "final", label: "Entregue final" },
];

function CaptureItem({ post }: { post: EditorialPost }) {
  const [status, setStatus] = useState<CaptureStatus>("pending");
  const [raws, setRaws] = useState<string[]>([]);
  const [link, setLink] = useState("");

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-ink">{post.title}</p>
          <p className="text-xs text-muted">
            {post.format} · {post.pillar} · ref: {post.references.length}
          </p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", CAPTURE[status].chip)}>
          {CAPTURE[status].label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          onClick={() => setStatus("done")}
          className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium", status === "done" ? "bg-emerald-600 text-white" : "border border-line text-ink hover:bg-subtle")}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> Capturado
        </button>
        <button
          onClick={() => setStatus("reshoot")}
          className={cn("inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium", status === "reshoot" ? "bg-rose-600 text-white" : "border border-line text-ink hover:bg-subtle")}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Refazer
        </button>
        {status !== "pending" && (
          <button onClick={() => setStatus("pending")} className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-subtle">limpar</button>
        )}
      </div>

      {status === "done" && (
        <div className="mt-2 rounded-lg bg-emerald-500/5 p-2">
          <p className="mb-1 text-[11px] text-emerald-600">
            ✔ Task da LE avançou de estágio · brutos liberados para o editor.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {raws.map((r, i) => (
              <a key={i} href={r} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-[10px] text-ink hover:bg-subtle-strong">
                <Film className="h-3 w-3" /> bruto {i + 1}
              </a>
            ))}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link dos brutos (drive, frame.io…)"
              className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400"
            />
            <button
              onClick={() => { if (link.trim()) { setRaws((p) => [...p, link.trim()]); setLink(""); } }}
              className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function VioDay({ editorial }: { editorial: EditorialLine }) {
  const items = editorial.posts.filter((p) => p.artDirection === "Media Day");
  const [footage, setFootage] = useState<FootageStatus>("awaiting");
  const [plan, setPlan] = useState({
    date: "28/06 · 09h",
    location: "Restaurante — salão e cozinha",
    team: "Fotógrafo + assistente",
    equipment: "Câmera + 2 lentes + luz contínua + tripé",
    notes: "Priorizar bastidores da cozinha no início do serviço.",
  });

  const done = items.length; // apenas mock: cada item controla o próprio status

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
            ["date", "Data & horário"],
            ["location", "Locação"],
            ["team", "Equipe"],
            ["equipment", "Equipamento"],
          ] as const).map(([k, label]) => (
            <label key={k} className="block">
              <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
              <input
                value={plan[k]}
                onChange={(e) => setPlan((p) => ({ ...p, [k]: e.target.value }))}
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
              />
            </label>
          ))}
          <label className="block sm:col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted">Anotações gerais</span>
            <textarea
              value={plan.notes}
              onChange={(e) => setPlan((p) => ({ ...p, notes: e.target.value }))}
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
            {items.map((p) => <CaptureItem key={p.n} post={p} />)}
          </div>
        )}
      </Card>

      {/* Fase 3 — Pós / entrega */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2">
          <Film className="h-4 w-4 text-brand-600" />
          <h3 className="text-sm font-semibold text-ink">3 · Pós / entrega</h3>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FOOTAGE.map((f) => (
            <button
              key={f.key}
              onClick={() => setFootage(f.key)}
              className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium", footage === f.key ? "bg-brand-600 text-white" : "border border-line text-muted hover:text-ink")}
            >
              {f.key === "raw_delivered" && <Link2 className="h-3.5 w-3.5" />}
              {f.label}
            </button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          {done} item(ns) na captação. Marcar &quot;Capturado&quot; avança a task na LE e libera os brutos ao editor.
        </p>
      </Card>
    </div>
  );
}
