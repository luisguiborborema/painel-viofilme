"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  BadgePercent,
  Download,
  ExternalLink,
  FileSignature,
  FileText,
  Layers,
  Pencil,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  CRM_DOCUMENT_KINDS,
  DOC_STATUSES,
  DOC_TEMPLATE_KINDS,
  SALES_MATERIAL_KINDS,
  TRACKED_DOC_KINDS,
  extractTemplateVars,
  type CrmDocument,
  type DocStatus,
  type DocTemplate,
  type SalesMaterial,
} from "@/lib/data/crm";

type Tab = "propostas" | "modelos" | "materiais";
type Deal = { id: string; name: string; owner?: string };

const KIND_LABEL = Object.fromEntries(CRM_DOCUMENT_KINDS.map((k) => [k.key, k.label]));
const TPL_KIND_LABEL = Object.fromEntries(DOC_TEMPLATE_KINDS.map((k) => [k.key, k.label]));
const MAT_KIND_LABEL = Object.fromEntries(SALES_MATERIAL_KINDS.map((k) => [k.key, k.label]));
const STATUS = Object.fromEntries(DOC_STATUSES.map((s) => [s.key, s]));

const TONE: Record<string, string> = {
  muted: "bg-black/5 text-muted",
  brand: "bg-brand-100 text-brand-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  red: "bg-red-100 text-red-700",
};

const inputCls = "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

function fmtMoney(v?: number) {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}
function isExpired(d: CrmDocument) {
  return d.expiresAt != null && new Date(d.expiresAt).getTime() < Date.now() && d.status !== "signed";
}

async function post(url: string, body: unknown) {
  return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
}

function StatusBadge({ status }: { status?: DocStatus }) {
  const s = STATUS[status ?? "draft"] ?? STATUS.draft;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[s.tone]}`}>{s.label}</span>;
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface p-5 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function CrmDocumentos({
  documents,
  templates,
  materials,
  deals,
  companies,
  team,
}: {
  documents: CrmDocument[];
  templates: DocTemplate[];
  materials: SalesMaterial[];
  deals: Deal[];
  companies: { id: string; name: string }[];
  team: string[];
}) {
  const [tab, setTab] = useState<Tab>("propostas");
  const tracked = documents.filter((d) => TRACKED_DOC_KINDS.has(d.kind));

  const TABS: { key: Tab; label: string; icon: typeof FileText; count: number }[] = [
    { key: "propostas", label: "Propostas & Contratos", icon: FileSignature, count: tracked.length },
    { key: "modelos", label: "Modelos", icon: Layers, count: templates.length },
    { key: "materiais", label: "Materiais de venda", icon: FileText, count: materials.length },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium transition ${
                active ? "border-brand-500 bg-brand-500 text-white" : "border-line bg-surface text-muted hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-white/20" : "bg-black/5 text-muted"}`}>{t.count}</span>
            </button>
          );
        })}
      </div>

      {tab === "propostas" && <PropostasPanel docs={tracked} team={team} />}
      {tab === "modelos" && <ModelosPanel templates={templates} deals={deals} companies={companies} />}
      {tab === "materiais" && <MateriaisPanel materials={materials} />}
    </div>
  );
}

// ── Aba 1: Propostas & Contratos (central de rastreio) ──────────────────────
type QuickFilter = "todos" | "abertas" | "assinatura" | "nao_vistas" | "vencidas";
const QUICK: { key: QuickFilter; label: string }[] = [
  { key: "todos", label: "Todos" },
  { key: "abertas", label: "Propostas em aberto" },
  { key: "assinatura", label: "Aguardando assinatura" },
  { key: "nao_vistas", label: "Não visualizadas" },
  { key: "vencidas", label: "Vencendo/vencidas" },
];

function PropostasPanel({ docs, team }: { docs: CrmDocument[]; team: string[] }) {
  const router = useRouter();
  const [quick, setQuick] = useState<QuickFilter>("todos");
  const [owner, setOwner] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(() => {
    return docs.filter((d) => {
      if (owner && d.owner !== owner) return false;
      switch (quick) {
        case "abertas":
          return d.kind === "proposta" && ["draft", "sent", "viewed"].includes(d.status ?? "draft");
        case "assinatura":
          return (d.kind === "contrato" || d.kind === "aditivo") && ["sent", "viewed"].includes(d.status ?? "");
        case "nao_vistas":
          return d.status === "sent" && !d.viewedAt;
        case "vencidas":
          return isExpired(d) || d.status === "expired";
        default:
          return true;
      }
    });
  }, [docs, quick, owner]);

  async function setStatus(id: string, status: string) {
    setBusy(true);
    await post("/api/crm/documents", { action: "set-status", id, status });
    setBusy(false);
    router.refresh();
  }
  async function sendSignature(d: CrmDocument) {
    if (!window.confirm("Enviar para assinatura? (ZapSign, se habilitado; senão marca como enviado)")) return;
    setBusy(true);
    const res = await post("/api/crm/documents", { action: "zapsign", id: d.id, dealId: d.dealId });
    const out = (await res?.json().catch(() => ({}))) as { mode?: string };
    setBusy(false);
    router.refresh();
    if (out?.mode === "manual") window.alert("ZapSign desabilitada — documento marcado como enviado (fallback manual).");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {QUICK.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setQuick(f.key)}
            className={`rounded-full border px-3 py-1 text-xs ${
              quick === f.key ? "border-brand-500 bg-brand-500 text-white" : "border-line text-muted hover:text-ink"
            }`}
          >
            {f.label}
          </button>
        ))}
        <select value={owner} onChange={(e) => setOwner(e.target.value)} className="ml-auto rounded-lg border border-line bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-brand-400">
          <option value="">Todos os responsáveis</option>
          {team.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-black/[0.02] text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2.5 font-medium">Documento</th>
              <th className="px-3 py-2.5 font-medium">Negócio</th>
              <th className="px-3 py-2.5 font-medium">Responsável</th>
              <th className="px-3 py-2.5 text-right font-medium">Valor</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 font-medium">Datas</th>
              <th className="px-3 py-2.5 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-sm text-muted">
                  Nenhum documento nesta visão.
                </td>
              </tr>
            )}
            {rows.map((d) => {
              const expired = isExpired(d);
              return (
                <tr key={d.id} className={`border-b border-line/60 last:border-0 ${expired ? "bg-red-50/50" : ""}`}>
                  <td className="px-3 py-2.5">
                    <div className="font-medium text-ink">{d.title}</div>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">{KIND_LABEL[d.kind] ?? d.kind}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {d.dealId ? (
                      <Link href={`/gerencial/crm/${d.dealId}`} className="text-brand-600 hover:underline">
                        {d.dealName ?? "negócio"}
                      </Link>
                    ) : d.companyName ? (
                      <span className="text-muted">{d.companyName}</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600" title="Sem negócio vinculado">
                        <BadgePercent className="h-3.5 w-3.5" /> avulso
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{d.owner ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right font-medium text-ink">{fmtMoney(d.value)}</td>
                  <td className="px-3 py-2.5">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-3 py-2.5 text-xs text-muted">
                    <div>criado {fmtDate(d.createdAt)}</div>
                    {d.signedAt ? (
                      <div className="text-emerald-600">assinado {fmtDate(d.signedAt)}</div>
                    ) : d.expiresAt ? (
                      <div className={expired ? "text-red-600" : ""}>vence {fmtDate(d.expiresAt)}</div>
                    ) : d.sentAt ? (
                      <div>enviado {fmtDate(d.sentAt)}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1.5">
                      {d.url && (
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-muted hover:text-brand-600" title="Abrir/baixar">
                          <Download className="h-4 w-4" />
                        </a>
                      )}
                      {(d.kind === "contrato" || d.kind === "aditivo") && d.status !== "signed" && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => sendSignature(d)}
                          className="text-muted hover:text-brand-600 disabled:opacity-50"
                          title="Enviar para assinatura"
                        >
                          <Send className="h-4 w-4" />
                        </button>
                      )}
                      <select
                        value={d.status ?? "draft"}
                        disabled={busy}
                        onChange={(e) => setStatus(d.id, e.target.value)}
                        className="rounded-lg border border-line bg-surface px-1.5 py-1 text-xs text-ink outline-none focus:border-brand-400"
                        title="Mudar status"
                      >
                        {DOC_STATUSES.map((s) => (
                          <option key={s.key} value={s.key}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted">
        Status muda por integração (ZapSign) ou manualmente aqui. Propostas vencidas aparecem destacadas — sinal de
        follow-up.
      </p>
    </div>
  );
}

// ── Aba 2: Modelos ──────────────────────────────────────────────────────────
function ModelosPanel({ templates, deals, companies }: { templates: DocTemplate[]; deals: Deal[]; companies: { id: string; name: string }[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<DocTemplate | "new" | null>(null);
  const [gen, setGen] = useState<DocTemplate | null>(null);

  async function remove(id: string) {
    if (!window.confirm("Excluir este modelo?")) return;
    await post("/api/crm/doc-templates", { action: "delete", id });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">Modelos que alimentam a geração de documentos (Ficha e Produtos).</p>
        <button
          type="button"
          onClick={() => setEdit("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> Novo modelo
        </button>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">Nenhum modelo cadastrado.</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((t) => (
            <div key={t.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-ink">{t.name}</div>
                  <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">{TPL_KIND_LABEL[t.kind] ?? t.kind}</span>
                  {!t.isActive && <span className="ml-1 text-[11px] text-red-500">inativo</span>}
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => setEdit(t)} className="text-muted hover:text-brand-600" title="Editar">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => remove(t.id)} className="text-muted hover:text-red-500" title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {t.description && <p className="mt-1 text-sm text-muted">{t.description}</p>}
              {t.variables.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {t.variables.map((v) => (
                    <span key={v} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-600">{`{${v}}`}</span>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => setGen(t)}
                className="mt-3 inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink hover:bg-subtle"
              >
                <FileText className="h-3.5 w-3.5" /> Gerar documento
              </button>
            </div>
          ))}
        </div>
      )}

      {edit && <TemplateForm template={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
      {gen && <GenerateForm template={gen} deals={deals} companies={companies} onClose={() => setGen(null)} />}
    </div>
  );
}

function TemplateForm({ template, onClose }: { template: DocTemplate | null; onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState(template?.name ?? "");
  const [kind, setKind] = useState(template?.kind ?? "proposta");
  const [description, setDescription] = useState(template?.description ?? "");
  const [content, setContent] = useState(template?.content ?? "");
  const [busy, setBusy] = useState(false);
  const vars = extractTemplateVars(content);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    await post("/api/crm/doc-templates", {
      action: template ? "update" : "create",
      id: template?.id,
      name,
      kind,
      description,
      content,
    });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Overlay title={template ? "Editar modelo" : "Novo modelo"} onClose={onClose}>
      <div className="space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do modelo" className={inputCls} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
          {DOC_TEMPLATE_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição (opcional)" className={inputCls} />
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={7}
            placeholder="Corpo do modelo. Use variáveis entre chaves: {empresa}, {valor}, {pacote}…"
            className={`${inputCls} font-mono text-xs`}
          />
          {vars.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              <span className="text-[11px] text-muted">Variáveis:</span>
              {vars.map((v) => (
                <span key={v} className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] text-brand-600">{`{${v}}`}</span>
              ))}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !name.trim()}
            onClick={save}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </Overlay>
  );
}

function GenerateForm({
  template,
  deals,
  companies,
  onClose,
}: {
  template: DocTemplate;
  deals: Deal[];
  companies: { id: string; name: string }[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [dealId, setDealId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [value, setValue] = useState("");
  const [vals, setVals] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function fill(content?: string) {
    let out = content ?? "";
    for (const [k, v] of Object.entries(vals)) out = out.replaceAll(`{${k}}`, v || `{${k}}`);
    return out;
  }

  async function generate() {
    setBusy(true);
    const dealName = deals.find((d) => d.id === dealId)?.name;
    await post("/api/crm/documents", {
      action: "generate",
      title: `${template.name}${dealName ? ` — ${dealName}` : ""}`,
      kind: template.kind,
      content: fill(template.content),
      templateId: template.id,
      dealId: dealId || undefined,
      companyId: companyId || undefined,
      value: value ? Number(value) : undefined,
    });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Overlay title={`Gerar: ${template.name}`} onClose={onClose}>
      <div className="space-y-3">
        <select value={dealId} onChange={(e) => setDealId(e.target.value)} className={inputCls}>
          <option value="">Vincular a um negócio (opcional)</option>
          {deals.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        {!dealId && (
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={inputCls}>
            <option value="">…ou a uma empresa (opcional)</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <input value={value} onChange={(e) => setValue(e.target.value)} type="number" placeholder="Valor (R$)" className={inputCls} />
        {template.variables.length > 0 && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <p className="text-xs font-medium text-muted">Preencher variáveis</p>
            {template.variables.map((v) => (
              <input
                key={v}
                value={vals[v] ?? ""}
                onChange={(e) => setVals((prev) => ({ ...prev, [v]: e.target.value }))}
                placeholder={`{${v}}`}
                className={inputCls}
              />
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={generate}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Gerar rascunho
          </button>
        </div>
      </div>
    </Overlay>
  );
}

// ── Aba 3: Materiais de venda ───────────────────────────────────────────────
function MateriaisPanel({ materials }: { materials: SalesMaterial[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<SalesMaterial | "new" | null>(null);

  async function use(id: string) {
    await post("/api/crm/sales-materials", { action: "use", id });
    router.refresh();
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir este material?")) return;
    await post("/api/crm/sales-materials", { action: "delete", id });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">O que o vendedor envia ao lead durante a negociação.</p>
        <button
          type="button"
          onClick={() => setEdit("new")}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" /> Novo material
        </button>
      </div>

      {materials.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">Nenhum material cadastrado.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {materials.map((m) => {
            const href = m.link || m.fileUrl;
            return (
              <div key={m.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-ink">{m.title}</div>
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">{MAT_KIND_LABEL[m.kind] ?? m.kind}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setEdit(m)} className="text-muted hover:text-brand-600" title="Editar">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => remove(m.id)} className="text-muted hover:text-red-500" title="Excluir">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {m.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {m.tags.map((t) => (
                      <span key={t} className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-muted">{m.usageCount} envio(s)</span>
                  {href && (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => use(m.id)}
                      className="inline-flex items-center gap-1 text-brand-600 hover:underline"
                    >
                      Enviar/abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {edit && <MaterialForm material={edit === "new" ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function MaterialForm({ material, onClose }: { material: SalesMaterial | null; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(material?.title ?? "");
  const [kind, setKind] = useState(material?.kind ?? "outro");
  const [link, setLink] = useState(material?.link ?? "");
  const [tags, setTags] = useState((material?.tags ?? []).join(", "));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setBusy(true);
    await post("/api/crm/sales-materials", {
      action: material ? "update" : "create",
      id: material?.id,
      title,
      kind,
      link,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setBusy(false);
    onClose();
    router.refresh();
  }

  return (
    <Overlay title={material ? "Editar material" : "Novo material"} onClose={onClose}>
      <div className="space-y-3">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className={inputCls} />
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
          {SALES_MATERIAL_KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.label}
            </option>
          ))}
        </select>
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Link (URL do material)" className={inputCls} />
        <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="Tags (serviço/segmento, separadas por vírgula)" className={inputCls} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-2 text-sm text-muted hover:text-ink">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={save}
            className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    </Overlay>
  );
}
