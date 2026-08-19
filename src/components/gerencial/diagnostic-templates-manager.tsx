"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { DiagnosticComputed, DiagnosticFieldType, DiagnosticQuestion, DiagnosticTemplate } from "@/lib/data/diagnostic";

const inputCls = "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted";

const TYPE_LABEL: Record<DiagnosticFieldType, string> = { text: "Texto curto", textarea: "Texto longo", number: "Número", currency: "Valor (R$)", choice: "Escolha única" };

type Draft = { id: string | null; name: string; area: string; questions: DiagnosticQuestion[]; computed: DiagnosticComputed[] };
const blankDraft = (): Draft => ({ id: null, name: "Novo modelo", area: "comercial", questions: [], computed: [] });
const toDraft = (t: DiagnosticTemplate): Draft => ({ id: t.id, name: t.name, area: t.area, questions: t.questions.map((q) => ({ ...q })), computed: t.computed.map((c) => ({ ...c })) });

export function DiagnosticTemplatesManager({ templates }: { templates: DiagnosticTemplate[] }) {
  const [list, setList] = useState<DiagnosticTemplate[]>(templates);
  const [selId, setSelId] = useState<string | null>(templates[0]?.id ?? null);
  const [draft, setDraft] = useState<Draft>(templates[0] ? toDraft(templates[0]) : blankDraft());
  const [busy, setBusy] = useState(false);

  function selectTpl(t: DiagnosticTemplate) {
    setSelId(t.id);
    setDraft(toDraft(t));
  }
  function newTpl() {
    setSelId(null);
    setDraft(blankDraft());
  }

  const setQ = (i: number, patch: Partial<DiagnosticQuestion>) => setDraft((d) => ({ ...d, questions: d.questions.map((q, k) => (k === i ? { ...q, ...patch } : q)) }));
  const addQ = () => setDraft((d) => ({ ...d, questions: [...d.questions, { id: `q${Date.now().toString(36)}`, label: "", type: "text", options: [], hint: "" }] }));
  const rmQ = (i: number) => setDraft((d) => ({ ...d, questions: d.questions.filter((_, k) => k !== i) }));

  const setC = (i: number, patch: Partial<DiagnosticComputed>) => setDraft((d) => ({ ...d, computed: d.computed.map((c, k) => (k === i ? { ...c, ...patch } : c)) }));
  const addC = () => setDraft((d) => ({ ...d, computed: [...d.computed, { id: `c${Date.now().toString(36)}`, label: "", formula: "", format: "number" }] }));
  const rmC = (i: number) => setDraft((d) => ({ ...d, computed: d.computed.filter((_, k) => k !== i) }));

  async function save() {
    if (!draft.name.trim()) { toast("Dê um nome ao modelo.", "error"); return; }
    setBusy(true);
    try {
      const body = {
        action: draft.id ? "update" : "create",
        id: draft.id ?? undefined,
        name: draft.name,
        area: draft.area,
        questions: draft.questions.filter((q) => q.label.trim()),
        computed: draft.computed.filter((c) => c.label.trim() && c.formula.trim()),
      };
      const res = await fetch("/api/gerencial/diagnostico-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => null);
      if (!res.ok) { toast(j?.error ?? "Falha ao salvar.", "error"); return; }
      const savedId = draft.id ?? j?.id;
      const saved: DiagnosticTemplate = { id: savedId, name: draft.name, area: draft.area as DiagnosticTemplate["area"], questions: body.questions, computed: body.computed, position: 0 };
      setList((l) => (draft.id ? l.map((t) => (t.id === draft.id ? saved : t)) : [...l, saved]));
      setSelId(savedId);
      setDraft({ ...draft, id: savedId });
      toast("Modelo salvo.", "success");
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!draft.id) { newTpl(); return; }
    if (!window.confirm(`Excluir o modelo "${draft.name}"?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/gerencial/diagnostico-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id: draft.id }) });
      if (!res.ok) { toast("Falha ao excluir.", "error"); return; }
      const rest = list.filter((t) => t.id !== draft.id);
      setList(rest);
      if (rest[0]) selectTpl(rest[0]);
      else newTpl();
    } finally {
      setBusy(false);
    }
  }

  const varHint = draft.questions.map((q) => q.id).join(", ");

  return (
    <div className="space-y-4">
      <Link href="/gerencial/diagnostico" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Diagnósticos
      </Link>

      {/* Abas de modelos */}
      <div className="flex flex-wrap items-center gap-2">
        {list.map((t) => (
          <button key={t.id} onClick={() => selectTpl(t)} className={cn("rounded-xl px-3 py-1.5 text-sm font-medium", selId === t.id ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:text-ink")}>
            {t.name}
          </button>
        ))}
        <button onClick={newTpl} className={cn("inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-sm font-medium", selId === null ? "bg-brand-600 text-white" : "border border-dashed border-line text-muted hover:text-ink")}>
          <Plus className="h-3.5 w-3.5" /> Novo modelo
        </button>
      </div>

      <Card className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block sm:col-span-2">
            <span className={labelCls}>Nome do modelo</span>
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Área</span>
            <select value={draft.area} onChange={(e) => setDraft((d) => ({ ...d, area: e.target.value }))} className={inputCls}>
              <option value="comercial">Comercial</option>
              <option value="entregas">Entregas</option>
              <option value="outro">Outro</option>
            </select>
          </label>
        </div>

        {/* Perguntas */}
        <div className="border-t border-line pt-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Perguntas</p>
            <button onClick={addQ} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle"><Plus className="h-3.5 w-3.5" /> Pergunta</button>
          </div>
          <div className="space-y-2.5">
            {draft.questions.map((q, i) => (
              <div key={i} className="rounded-xl border border-line p-2.5">
                <div className="flex items-start gap-2">
                  <GripVertical className="mt-2 h-4 w-4 shrink-0 text-muted/50" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <input value={q.label} onChange={(e) => setQ(i, { label: e.target.value })} placeholder="Pergunta" className={inputCls} />
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted">id: {q.id}</span>
                      <select value={q.type} onChange={(e) => setQ(i, { type: e.target.value as DiagnosticFieldType })} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400">
                        {(Object.keys(TYPE_LABEL) as DiagnosticFieldType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                      </select>
                      <input value={q.hint} onChange={(e) => setQ(i, { hint: e.target.value })} placeholder="Dica (opcional)" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400" />
                    </div>
                    {q.type === "choice" && (
                      <input value={q.options.join(", ")} onChange={(e) => setQ(i, { options: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="Opções separadas por vírgula" className={inputCls} />
                    )}
                  </div>
                  <button onClick={() => rmQ(i)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Campos calculados */}
        <div className="border-t border-line pt-4">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">Campos calculados (fórmulas)</p>
            <button onClick={addC} className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink hover:bg-subtle"><Plus className="h-3.5 w-3.5" /> Cálculo</button>
          </div>
          <p className="mb-2 text-[11px] text-muted">Use os <span className="font-mono">ids</span> das perguntas nas fórmulas (+ − × ÷ e parênteses). Disponíveis: <span className="font-mono">{varHint || "—"}</span></p>
          <div className="space-y-2.5">
            {draft.computed.map((c, i) => (
              <div key={i} className="rounded-xl border border-line p-2.5">
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <input value={c.label} onChange={(e) => setC(i, { label: e.target.value })} placeholder="Nome do resultado (ex.: Perda estimada)" className={inputCls} />
                    <div className="flex flex-wrap items-center gap-2">
                      <input value={c.formula} onChange={(e) => setC(i, { formula: e.target.value })} placeholder="Fórmula (ex.: leads_mes * (1 - conversao/100) * ticket)" className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 py-1 font-mono text-xs text-ink outline-none focus:border-brand-400" />
                      <select value={c.format} onChange={(e) => setC(i, { format: e.target.value as DiagnosticComputed["format"] })} className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-400">
                        <option value="number">Número</option>
                        <option value="currency">R$</option>
                        <option value="percent">%</option>
                      </select>
                    </div>
                  </div>
                  <button onClick={() => rmC(i)} className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line pt-4">
          <button onClick={del} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> Excluir modelo
          </button>
          <button onClick={save} disabled={busy} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar modelo
          </button>
        </div>
      </Card>
    </div>
  );
}
