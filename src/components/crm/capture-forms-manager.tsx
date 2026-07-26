"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FormInput,
  GripVertical,
  Inbox,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  FORM_FIELD_MAPS,
  FORM_FIELD_TYPES,
  type CaptureForm,
  type FormDestination,
  type FormField,
  type FormFieldMap,
  type FormFieldType,
  type Pipeline,
} from "@/lib/data/crm";
import { toast } from "@/components/ui/toast";
import { EmptyState } from "./settings-ui";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";
const selCls =
  "rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400";

const TASK_TYPES = ["Arte", "Vídeo", "Copy", "Tráfego"];

async function post(body: unknown): Promise<boolean> {
  const res = await fetch("/api/crm/capture-forms", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  return Boolean(res?.ok);
}

export function CaptureFormsManager({
  forms,
  team = [],
  pipelines = [],
  clients = [],
}: {
  forms: CaptureForm[];
  team?: string[];
  pipelines?: Pipeline[];
  clients?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [destination, setDestination] = useState<FormDestination>("crm");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [showResp, setShowResp] = useState<CaptureForm | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function create() {
    if (!name.trim() || busy) return;
    setBusy(true);
    await post({ action: "create", name: name.trim(), destination });
    setName("");
    setBusy(false);
    router.refresh();
  }

  async function act(body: unknown) {
    setBusy(true);
    await post(body);
    setBusy(false);
    router.refresh();
  }

  function copy(slug: string) {
    navigator.clipboard?.writeText(`${origin}/captura/${slug}`).then(() => {
      setCopied(slug);
      setTimeout(() => setCopied((c) => (c === slug ? null : c)), 1500);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-3">
        <label className="flex-1">
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Novo formulário / briefing</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            placeholder="Ex.: Briefing de novo cliente"
            className={inputCls}
          />
        </label>
        <label>
          <span className="mb-0.5 block text-[11px] font-medium text-muted">Cria card em</span>
          <select value={destination} onChange={(e) => setDestination(e.target.value as FormDestination)} className={inputCls + " w-44"}>
            <option value="crm">Comercial (negócio)</option>
            <option value="entregas">Painel de Entregas (tarefa)</option>
          </select>
        </label>
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>

      {forms.map((f) => (
        <div key={f.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                {f.name}
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-[10px] font-medium " +
                    (f.destination === "entregas"
                      ? "bg-violet-500/15 text-violet-600"
                      : "bg-brand-500/15 text-brand-600")
                  }
                >
                  {f.destination === "entregas" ? "→ Entregas" : "→ Comercial"}
                </span>
                {!f.active && <span className="text-xs font-normal text-muted">(inativo)</span>}
              </p>
              <p className="text-xs text-muted">
                Origem: {f.source} · {f.fields.length} campo(s)
                {typeof f.submissions === "number" && f.submissions > 0 && ` · ${f.submissions} envio(s)`}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowResp(f)}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-subtle"
              >
                <Inbox className="h-3.5 w-3.5" /> Respostas
                {typeof f.submissions === "number" && f.submissions > 0 && ` (${f.submissions})`}
              </button>
              <button
                onClick={() => setOpen((o) => (o === f.id ? null : f.id))}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-subtle"
              >
                Editar
                <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (open === f.id ? "rotate-180" : "")} />
              </button>
              <button
                onClick={() => act({ action: "update", id: f.id, active: !f.active })}
                className="rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-subtle"
              >
                {f.active ? "Desativar" : "Ativar"}
              </button>
              <button
                onClick={() => act({ action: "delete", id: f.id })}
                className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                title="Excluir"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2 rounded-lg bg-canvas px-2.5 py-1.5">
            <code className="min-w-0 flex-1 truncate text-xs text-muted">{origin}/captura/{f.slug}</code>
            <button onClick={() => copy(f.slug)} className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline">
              {copied === f.slug ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied === f.slug ? "copiado" : "copiar link"}
            </button>
            <a href={`/captura/${f.slug}`} target="_blank" rel="noreferrer" className="text-muted hover:text-ink" title="Abrir">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {open === f.id && (
            <FormEditor key={f.id} form={f} team={team} pipelines={pipelines} clients={clients} />
          )}
        </div>
      ))}
      {forms.length === 0 && (
        <EmptyState icon={FormInput}>Nenhum formulário ainda. Crie o primeiro acima.</EmptyState>
      )}
      {busy && <Loader2 className="h-4 w-4 animate-spin text-muted" />}

      {showResp && <SubmissionsModal form={showResp} onClose={() => setShowResp(null)} />}
    </div>
  );
}

type Submission = {
  id: string;
  values: Record<string, unknown>;
  leadId: string | null;
  taskId: string | null;
  createdAt: string;
};

function SubmissionsModal({ form, onClose }: { form: CaptureForm; onClose: () => void }) {
  const [subs, setSubs] = useState<Submission[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/crm/capture-forms?formId=${encodeURIComponent(form.id)}`)
      .then((r) => r.json())
      .then((j) => {
        if (alive) setSubs((j.submissions as Submission[]) ?? []);
      })
      .catch(() => {
        if (alive) setSubs([]);
      });
    return () => {
      alive = false;
    };
  }, [form.id]);

  const labelOf = (key: string) => form.fields.find((f) => f.fieldKey === key)?.label ?? key;
  function entriesOf(values: Record<string, unknown>) {
    const ordered = form.fields.map((f) => f.fieldKey);
    const extra = Object.keys(values).filter((k) => !ordered.includes(k));
    return [...ordered, ...extra]
      .map((k) => [k, values[k]] as const)
      .filter(([, v]) => v != null && String(v).trim() !== "");
  }
  function fmtDate(iso: string) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? iso : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink">
              <Inbox className="h-4 w-4 text-brand-500" /> Respostas · {form.name}
            </h3>
            <p className="text-xs text-muted">{subs == null ? "carregando…" : `${subs.length} envio(s)`}</p>
          </div>
          <button onClick={onClose} title="Fechar" aria-label="Fechar" className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        {subs == null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : subs.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-3 py-8 text-center text-sm text-muted">
            Nenhuma resposta ainda. Compartilhe o link do formulário.
          </p>
        ) : (
          <ul className="space-y-3">
            {subs.map((s) => {
              const entries = entriesOf(s.values);
              return (
                <li key={s.id} className="rounded-xl border border-line bg-canvas p-3">
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-muted">{fmtDate(s.createdAt)}</span>
                    {s.leadId ? (
                      <Link href={`/gerencial/crm/${s.leadId}`} className="text-[11px] font-medium text-brand-600 hover:underline">
                        Abrir negócio →
                      </Link>
                    ) : s.taskId ? (
                      <Link href={`/gerencial/entregas?task=${s.taskId}`} className="text-[11px] font-medium text-brand-600 hover:underline">
                        Abrir tarefa →
                      </Link>
                    ) : null}
                  </div>
                  {entries.length === 0 ? (
                    <p className="text-xs text-muted">(sem dados)</p>
                  ) : (
                    <dl className="space-y-1">
                      {entries.map(([k, v]) => (
                        <div key={k} className="flex gap-2 text-xs">
                          <dt className="shrink-0 font-medium text-muted">{labelOf(k)}:</dt>
                          <dd className="min-w-0 break-words text-ink">{String(v)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

type EditField = FormField & { uid: number };

function FormEditor({
  form,
  team,
  pipelines,
  clients,
}: {
  form: CaptureForm;
  team: string[];
  pipelines: Pipeline[];
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const uid = useRef(form.fields.length);
  const [destination, setDestination] = useState<FormDestination>(form.destination);
  const [pipelineId, setPipelineId] = useState(form.pipelineId ?? "");
  const [stageId, setStageId] = useState(form.stageId ?? "");
  const [clientId, setClientId] = useState(form.clientId ?? "");
  const [taskType, setTaskType] = useState(form.taskType ?? "Arte");
  const [owner, setOwner] = useState(form.owner ?? "");
  const [source, setSource] = useState(form.source);
  const [description, setDescription] = useState(form.description ?? "");
  const [fields, setFields] = useState<EditField[]>(() =>
    form.fields.map((f, i) => ({ ...f, uid: i })),
  );
  const [saving, setSaving] = useState(false);

  const stages = pipelines.find((p) => p.id === pipelineId)?.stages ?? [];

  function addField() {
    setFields((prev) => [
      ...prev,
      {
        uid: uid.current++,
        id: "",
        fieldKey: "",
        label: "",
        fieldType: "text",
        options: [],
        required: false,
        mapTo: "custom",
        position: prev.length,
        active: true,
      },
    ]);
  }
  function patchField(u: number, patch: Partial<EditField>) {
    setFields((prev) => prev.map((f) => (f.uid === u ? { ...f, ...patch } : f)));
  }
  function removeField(u: number) {
    setFields((prev) => prev.filter((f) => f.uid !== u));
  }
  function move(u: number, dir: -1 | 1) {
    setFields((prev) => {
      const i = prev.findIndex((f) => f.uid === u);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    const okCfg = await post({
      action: "update",
      id: form.id,
      destination,
      pipelineId: destination === "crm" ? pipelineId || null : null,
      stageId: destination === "crm" ? stageId || null : null,
      clientId: destination === "entregas" ? clientId || null : null,
      taskType: destination === "entregas" ? taskType || null : null,
      owner: owner || "",
      source: source.trim() || "Formulário",
      description: description || null,
    });
    const okFields = await post({
      action: "save-fields",
      id: form.id,
      fields: fields.map((f, i) => ({
        fieldKey: f.fieldKey,
        label: f.label,
        fieldType: f.fieldType,
        options:
          f.fieldType === "select"
            ? f.options
                .map((o) => ({ value: o.label.trim(), label: o.label.trim() }))
                .filter((o) => o.label)
            : [],
        required: f.required,
        mapTo: f.mapTo,
        position: i,
        active: f.active,
      })),
    });
    setSaving(false);
    if (okCfg && okFields) toast("Formulário salvo.", "success");
    else toast("Não foi possível salvar. Tente de novo.", "error");
    router.refresh();
  }

  const hasTitle = fields.some((f) => f.mapTo === "title" && f.label.trim());

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-line bg-canvas p-3">
      {/* Destino + parametrização */}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-muted">Ao preencher, cria</span>
          <select value={destination} onChange={(e) => setDestination(e.target.value as FormDestination)} className={inputCls}>
            <option value="crm">Comercial — negócio no funil</option>
            <option value="entregas">Painel de Entregas — tarefa</option>
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-muted">Origem (aparece no card)</span>
          <input value={source} onChange={(e) => setSource(e.target.value)} className={inputCls} />
        </label>

        {destination === "crm" ? (
          <>
            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-muted">Funil de destino</span>
              <select
                value={pipelineId}
                onChange={(e) => {
                  setPipelineId(e.target.value);
                  setStageId("");
                }}
                className={inputCls}
              >
                <option value="">Funil padrão</option>
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-muted">Etapa de destino</span>
              <select value={stageId} onChange={(e) => setStageId(e.target.value)} className={inputCls} disabled={!stages.length}>
                <option value="">Primeira etapa aberta</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <>
            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-muted">Cliente da tarefa</span>
              <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={inputCls}>
                <option value="">Sem cliente (avulsa)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              <span className="mb-0.5 block font-medium text-muted">Tipo da tarefa</span>
              <input
                value={taskType}
                onChange={(e) => setTaskType(e.target.value)}
                list={`tasktypes-${form.id}`}
                placeholder="Ex.: Arte, Motion, Edição de vídeo…"
                className={inputCls}
              />
              <datalist id={`tasktypes-${form.id}`}>
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </label>
          </>
        )}

        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-muted">Responsável padrão</span>
          <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls}>
            <option value="">— (sem dono / rodízio manual)</option>
            {team.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="text-xs">
          <span className="mb-0.5 block font-medium text-muted">Descrição (topo do formulário)</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" className={inputCls} />
        </label>
      </div>

      {/* Editor de campos */}
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-semibold text-ink">Campos do formulário</p>
          <button onClick={addField} className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs font-medium text-ink hover:bg-subtle">
            <Plus className="h-3.5 w-3.5" /> Adicionar campo
          </button>
        </div>

        {fields.length === 0 && (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-xs text-muted">
            Nenhum campo. Adicione ao menos um e marque um como <strong>Título do card</strong>.
          </p>
        )}

        <div className="space-y-2">
          {fields.map((f) => (
            <div key={f.uid} className="rounded-lg border border-line bg-surface p-2">
              <div className="flex items-center gap-2">
                <div className="flex flex-col text-muted">
                  <button onClick={() => move(f.uid, -1)} className="hover:text-ink" title="Subir" aria-label="Subir">
                    <GripVertical className="h-3.5 w-3.5" />
                  </button>
                </div>
                <input
                  value={f.label}
                  onChange={(e) => patchField(f.uid, { label: e.target.value })}
                  placeholder="Pergunta / rótulo do campo"
                  className={inputCls + " flex-1"}
                />
                <select
                  value={f.fieldType}
                  onChange={(e) => patchField(f.uid, { fieldType: e.target.value as FormFieldType })}
                  className={selCls}
                >
                  {FORM_FIELD_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={f.mapTo}
                  onChange={(e) => patchField(f.uid, { mapTo: e.target.value as FormFieldMap })}
                  className={selCls}
                  title="Para onde este valor vai no card"
                >
                  {FORM_FIELD_MAPS.map((m) => (
                    <option key={m.key} value={m.key}>{m.label}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 whitespace-nowrap text-[11px] text-muted">
                  <input type="checkbox" checked={f.required} onChange={(e) => patchField(f.uid, { required: e.target.checked })} />
                  obrigatório
                </label>
                <button onClick={() => removeField(f.uid)} className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500" title="Remover" aria-label="Remover">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {f.fieldType === "select" && (
                <div className="mt-2 space-y-1.5 rounded-lg bg-canvas p-2">
                  <p className="text-[11px] font-medium text-muted">Opções da seleção</p>
                  {f.options.length === 0 && (
                    <p className="text-[11px] text-muted">Nenhuma opção ainda — adicione abaixo.</p>
                  )}
                  {f.options.map((o, oi) => (
                    <div key={oi} className="flex items-center gap-1.5">
                      <span className="w-4 text-right text-[11px] text-muted">{oi + 1}.</span>
                      <input
                        value={o.label}
                        onChange={(e) => {
                          const label = e.target.value;
                          patchField(f.uid, {
                            options: f.options.map((x, xi) => (xi === oi ? { value: label, label } : x)),
                          });
                        }}
                        placeholder={`Opção ${oi + 1}`}
                        className={inputCls + " flex-1 py-1"}
                      />
                      <button
                        onClick={() => patchField(f.uid, { options: f.options.filter((_, xi) => xi !== oi) })}
                        className="rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-500"
                        title="Remover opção"
                        aria-label="Remover opção"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => patchField(f.uid, { options: [...f.options, { value: "", label: "" }] })}
                    className="inline-flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-medium text-ink hover:bg-subtle"
                  >
                    <Plus className="h-3 w-3" /> Adicionar opção
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {!hasTitle && fields.length > 0 && (
          <p className="mt-2 text-[11px] text-amber-600">
            Dica: marque um campo como <strong>Título do card</strong>. Sem isso, o título usa o primeiro campo preenchido.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Salvar formulário
        </button>
      </div>
    </div>
  );
}
