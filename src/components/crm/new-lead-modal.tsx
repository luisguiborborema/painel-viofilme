"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  ClipboardPaste,
  Download,
  FileSpreadsheet,
  Loader2,
  Search,
  Upload,
  UserPlus,
  X,
} from "lucide-react";
import {
  PIPELINE_PREVENDA_ID,
  STAGE_RESERVOIR,
  type CrmLead,
  type Pipeline,
  type Tag,
} from "@/lib/data/crm";

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400";

const CSV_HEADER = "empresa,cnpj,contato,cargo,whatsapp,email,site,instagram,cidade_uf,tags,anotacao";
const CSV_SAMPLE =
  "Padaria do João,12.345.678/0001-90,Maria,Gerente,5527999990000,maria@padoca.com,padoca.com.br,@padocadojoao,Vitória/ES,Quente,Achei pelo Instagram\n" +
  "Ótica Vista Boa,,,,5527988887777,,,@oticavistaboa,Vila Velha/ES,,Sem site — só IG";
const ORIGINS = ["Outbound (prospecção)", "Indicação", "Evento", "Outro"];

type Row = {
  empresa?: string;
  titulo?: string;
  cnpj?: string;
  segmento?: string;
  source?: string;
  contato?: string;
  cargo?: string;
  whatsapp?: string;
  email?: string;
  site?: string;
  instagram?: string;
  cidade_uf?: string;
  tags?: string;
  tagIds?: string[];
  anotacao?: string;
};

function Labeled({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={full ? "col-span-2 block" : "block"}>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  );
}

/** Parser CSV simples (sem aspas): 1ª linha = cabeçalho, mapeia por nome de coluna. */
function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const keys = ["empresa", "cnpj", "contato", "cargo", "whatsapp", "email", "site", "instagram", "cidade_uf", "tags", "anotacao"];
  return lines
    .slice(1)
    .map((line) => {
      const cells = line.split(",");
      const row: Row = {};
      header.forEach((h, i) => {
        if (keys.includes(h)) (row as Record<string, string>)[h] = (cells[i] ?? "").trim();
      });
      return row;
    })
    .filter((r) => r.empresa?.trim());
}

export function NovoNegocioModal({
  onClose,
  onCreated,
  team = [],
  defaultOwner = "",
  tags = [],
  pipelines = [],
  defaultPipelineId,
}: {
  onClose: () => void;
  onCreated: (lead: CrmLead) => void;
  team?: string[];
  defaultOwner?: string;
  tags?: Tag[];
  pipelines?: Pipeline[];
  defaultPipelineId?: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"manual" | "import">("manual");
  const [owner, setOwner] = useState(defaultOwner);
  const [origin, setOrigin] = useState(ORIGINS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Funil + etapa de destino (permite criar em qualquer funil, não só o SDR).
  const [pipelineId, setPipelineId] = useState(defaultPipelineId || pipelines[0]?.id || PIPELINE_PREVENDA_ID);
  const [stageKey, setStageKey] = useState("");
  const selPipe = pipelines.find((p) => p.id === pipelineId);
  const stagesOf = selPipe?.stages ?? [];
  const effStageKey = stageKey || stagesOf[0]?.key || STAGE_RESERVOIR;

  function ownerSelect() {
    return (
      <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputCls}>
        {defaultOwner && !team.includes(defaultOwner) && <option value={defaultOwner}>{defaultOwner} (você)</option>}
        {team.map((name) => (
          <option key={name} value={name}>
            {name}
            {name === defaultOwner ? " (você)" : ""}
          </option>
        ))}
      </select>
    );
  }
  function originSelect() {
    return (
      <select value={origin} onChange={(e) => setOrigin(e.target.value)} className={inputCls}>
        {ORIGINS.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-line p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <Briefcase className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-ink">Novo negócio · prospecção outbound</h2>
              <p className="text-xs text-muted">
                Momento zero: você achou a empresa e vai atrás. Valor, plano e serviço entram na ficha depois.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-subtle">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Funil + etapa de destino */}
        <div className="grid grid-cols-2 gap-3 border-b border-line bg-canvas px-5 py-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Funil</span>
            {pipelines.length > 1 ? (
              <select
                value={pipelineId}
                onChange={(e) => { setPipelineId(e.target.value); setStageKey(""); }}
                className={inputCls}
              >
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            ) : (
              <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">{selPipe?.name ?? "Pré-venda (SDR)"}</p>
            )}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Etapa inicial</span>
            {stagesOf.length > 0 ? (
              <select value={effStageKey} onChange={(e) => setStageKey(e.target.value)} className={inputCls}>
                {stagesOf.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            ) : (
              <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">Contactar Urgente</p>
            )}
          </label>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-line px-4 pt-3">
          <TabBtn active={tab === "manual"} onClick={() => setTab("manual")} icon={Building2} label="Cadastro manual" />
          <TabBtn active={tab === "import"} onClick={() => setTab("import")} icon={Upload} label="Importar em massa" />
        </div>

        {tab === "manual" ? (
          <ManualForm
            ownerSelect={ownerSelect}
            originSelect={originSelect}
            tags={tags}
            busy={busy}
            error={error}
            onCancel={onClose}
            onSubmit={async (row) => {
              setBusy(true);
              setError(null);
              try {
                const res = await fetch("/api/crm/import-outbound", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rows: [{ ...row, source: origin }], owner: owner || undefined, pipelineId, stageKey: effStageKey }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? "falha");
                const nowIso = new Date().toISOString();
                onCreated({
                  id: json.id ?? `tmp-${Date.now()}`,
                  name: row.titulo?.trim() || row.empresa!.trim(),
                  contactName: row.contato?.trim() || undefined,
                  stage: effStageKey,
                  monthlyValue: 0,
                  mediaBudget: 0,
                  probability: 10,
                  bant: {},
                  pipelineId,
                  originKind: "outbound",
                  owner: owner || undefined,
                  assignees: owner ? [owner] : [],
                  tags: [],
                  properties: {},
                  prospectingNotes: row.anotacao?.trim() || undefined,
                  stageChangedAt: nowIso,
                  createdAt: nowIso,
                  updatedAt: nowIso,
                });
              } catch (e) {
                setError(e instanceof Error ? e.message : "erro");
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : (
          <ImportForm
            ownerSelect={ownerSelect}
            originSelect={originSelect}
            busy={busy}
            error={error}
            onCancel={onClose}
            onImport={async (rows) => {
              setBusy(true);
              setError(null);
              try {
                const res = await fetch("/api/crm/import-outbound", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ rows: rows.map((r) => ({ ...r, source: origin })), owner: owner || undefined, pipelineId, stageKey: effStageKey }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error ?? "falha");
                router.refresh();
                onClose();
              } catch (e) {
                setError(e instanceof Error ? e.message : "erro");
              } finally {
                setBusy(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Upload; label: string }) {
  return (
    <button
      onClick={onClick}
      className={
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors " +
        (active ? "border-brand-500 text-ink" : "border-transparent text-muted hover:text-ink")
      }
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );
}

/* ── Cadastro manual ───────────────────────────────────── */

function ManualForm({
  ownerSelect,
  originSelect,
  tags = [],
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  ownerSelect: () => React.ReactNode;
  originSelect: () => React.ReactNode;
  tags?: Tag[];
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (row: Row) => void;
}) {
  const [f, setF] = useState<Row>({});
  const [titleEdited, setTitleEdited] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [cnpjBusy, setCnpjBusy] = useState(false);
  const [cnpjMsg, setCnpjMsg] = useState<string | null>(null);
  const set = (k: keyof Row, v: string) => setF((p) => ({ ...p, [k]: v }));
  const toggleTag = (id: string) => setTagIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const empresa = f.empresa?.trim() ?? "";
  const titulo = titleEdited ? (f.titulo ?? "") : empresa;
  const canSubmit = Boolean(empresa) && !busy;

  async function lookupCnpj() {
    const digits = (f.cnpj ?? "").replace(/\D/g, "");
    if (digits.length !== 14) {
      setCnpjMsg("Informe 14 dígitos.");
      return;
    }
    setCnpjBusy(true);
    setCnpjMsg(null);
    try {
      const res = await fetch(`/api/crm/cnpj?cnpj=${digits}`);
      const j = await res.json();
      if (j.ok) {
        setF((p) => ({
          ...p,
          empresa: p.empresa?.trim() ? p.empresa : j.name,
          cidade_uf: p.cidade_uf?.trim() ? p.cidade_uf : j.cidadeUf,
          segmento: p.segmento?.trim() ? p.segmento : j.segment,
        }));
        setCnpjMsg("Dados preenchidos pela Receita.");
      } else {
        setCnpjMsg("Consulta indisponível — preencha manualmente.");
      }
    } catch {
      setCnpjMsg("Consulta indisponível — preencha manualmente.");
    } finally {
      setCnpjBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-5 p-5">
        {/* Empresa */}
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Building2 className="h-3.5 w-3.5" /> Empresa
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Nome da empresa *" full>
              <input autoFocus value={f.empresa ?? ""} onChange={(e) => set("empresa", e.target.value)} placeholder="Ex.: Padaria do João" className={inputCls} />
            </Labeled>
            <Labeled label="CNPJ" full>
              <div className="flex gap-2">
                <input value={f.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" className={inputCls} />
                <button
                  onClick={lookupCnpj}
                  disabled={cnpjBusy}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-60"
                >
                  {cnpjBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Consultar
                </button>
              </div>
              {cnpjMsg && <p className="mt-1 text-[11px] text-muted">{cnpjMsg}</p>}
            </Labeled>
            <Labeled label="Segmento">
              <input value={f.segmento ?? ""} onChange={(e) => set("segmento", e.target.value)} placeholder="Nicho / segmento" className={inputCls} />
            </Labeled>
            <Labeled label="Cidade/UF">
              <input value={f.cidade_uf ?? ""} onChange={(e) => set("cidade_uf", e.target.value)} placeholder="Vitória/ES" className={inputCls} />
            </Labeled>
            <Labeled label="Site">
              <input value={f.site ?? ""} onChange={(e) => set("site", e.target.value)} placeholder="site.com.br" className={inputCls} />
            </Labeled>
            <Labeled label="Instagram">
              <input value={f.instagram ?? ""} onChange={(e) => set("instagram", e.target.value)} placeholder="@perfil" className={inputCls} />
            </Labeled>
          </div>
        </div>

        {/* Contato (opcional) */}
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <UserPlus className="h-3.5 w-3.5" /> Contato <span className="normal-case text-muted">(se já achou)</span>
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Nome">
              <input value={f.contato ?? ""} onChange={(e) => set("contato", e.target.value)} className={inputCls} />
            </Labeled>
            <Labeled label="Cargo">
              <input value={f.cargo ?? ""} onChange={(e) => set("cargo", e.target.value)} className={inputCls} />
            </Labeled>
            <Labeled label="WhatsApp">
              <input value={f.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" placeholder="5527999998888" className={inputCls} />
            </Labeled>
            <Labeled label="E-mail">
              <input value={f.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputCls} />
            </Labeled>
          </div>
        </div>

        {/* Negócio */}
        <div>
          <p className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <Briefcase className="h-3.5 w-3.5" /> Negócio
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Labeled label="Título (auto = empresa)" full>
              <input
                value={titulo}
                onChange={(e) => {
                  setTitleEdited(true);
                  set("titulo", e.target.value);
                }}
                placeholder="Nome da empresa"
                className={inputCls}
              />
            </Labeled>
            <Labeled label="Anotações de prospecção" full>
              <textarea
                value={f.anotacao ?? ""}
                onChange={(e) => set("anotacao", e.target.value)}
                rows={3}
                placeholder="Contexto: como achou, o que viu, gancho pra abordagem…"
                className={inputCls + " resize-y"}
              />
            </Labeled>
            <Labeled label="Origem">{originSelect()}</Labeled>
            <Labeled label="Responsável">{ownerSelect()}</Labeled>
            {tags.length > 0 && (
              <Labeled label="Tags" full>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const on = tagIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className="rounded-full px-2.5 py-1 text-xs font-semibold transition-opacity"
                        style={{ backgroundColor: `${t.color}22`, color: t.color, opacity: on ? 1 : 0.45 }}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </Labeled>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line p-4">
        <button onClick={onCancel} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
          Cancelar
        </button>
        <button
          onClick={() => onSubmit({ ...f, titulo: titleEdited ? f.titulo : undefined, tagIds })}
          disabled={!canSubmit}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Briefcase className="h-4 w-4" />}
          Criar negócio
        </button>
      </div>
    </>
  );
}

/* ── Importação em massa ───────────────────────────────── */

function ImportForm({
  ownerSelect,
  originSelect,
  busy,
  error,
  onCancel,
  onImport,
}: {
  ownerSelect: () => React.ReactNode;
  originSelect: () => React.ReactNode;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onImport: (rows: Row[]) => void;
}) {
  const [mode, setMode] = useState<"colar" | "planilha">("colar");
  const [pasted, setPasted] = useState("");
  const [csvRows, setCsvRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Colar: 1 empresa por linha. Extrai CNPJ, WhatsApp e @instagram do texto,
  // o resto vira o nome da empresa.
  const pastedRows: Row[] = useMemo(
    () =>
      pasted
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const cnpjM = l.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/);
          const igM = l.match(/@[\w.]+/);
          const waM = l.replace(cnpjM?.[0] ?? "", "").match(/\d{10,13}/);
          let empresa = l;
          for (const tok of [cnpjM?.[0], igM?.[0], waM?.[0]]) if (tok) empresa = empresa.replace(tok, "");
          empresa = empresa.replace(/[,;|]+/g, " ").trim();
          return { empresa: empresa || l, cnpj: cnpjM?.[0], instagram: igM?.[0], whatsapp: waM?.[0] };
        }),
    [pasted],
  );

  const rows = mode === "colar" ? pastedRows : csvRows;

  function downloadTemplate() {
    const blob = new Blob([`${CSV_HEADER}\n${CSV_SAMPLE}\n`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo_prospeccao_viofilme.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvRows(parseCsv(String(reader.result ?? "")));
    reader.readAsText(file);
  }

  return (
    <>
      <div className="space-y-4 p-5">
        <div className="flex gap-1.5">
          <button
            onClick={() => setMode("colar")}
            className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold " + (mode === "colar" ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")}
          >
            <ClipboardPaste className="h-3.5 w-3.5" /> Colar texto
          </button>
          <button
            onClick={() => setMode("planilha")}
            className={"inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold " + (mode === "planilha" ? "bg-brand-600 text-white" : "bg-subtle text-muted hover:bg-subtle-strong")}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Planilha (CSV)
          </button>
        </div>

        {mode === "colar" ? (
          <div>
            <p className="mb-1 text-xs text-muted">Uma empresa por linha (caminho rápido).</p>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={8}
              placeholder={"Padaria do João\nÓtica Vista Boa\nAcademia Corpo em Foco"}
              className={inputCls + " resize-y font-mono"}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <button onClick={downloadTemplate} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-sm font-medium text-ink hover:bg-subtle">
              <Download className="h-4 w-4" /> Baixar planilha modelo (CSV)
            </button>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted hover:bg-subtle">
              <Upload className="h-4 w-4" />
              {fileName ? `Arquivo: ${fileName}` : "Selecionar CSV preenchido"}
              <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
            </label>
            <p className="text-[11px] text-muted">Cabeçalho esperado: {CSV_HEADER}</p>
          </div>
        )}

        {/* Prévia */}
        {rows.length > 0 && (
          <div className="rounded-xl border border-line bg-canvas p-3">
            <p className="mb-1.5 text-xs font-semibold text-ink">
              Prévia — {rows.length} {rows.length === 1 ? "empresa" : "empresas"} viram cards em Contactar Urgente
            </p>
            <ul className="max-h-32 space-y-0.5 overflow-y-auto text-sm text-ink">
              {rows.slice(0, 12).map((r, i) => (
                <li key={i} className="truncate">
                  • {r.empresa}
                  {r.contato ? <span className="text-muted"> — {r.contato}</span> : null}
                </li>
              ))}
              {rows.length > 12 && <li className="text-muted">…e mais {rows.length - 12}</li>}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Origem (todas)</span>
            {originSelect()}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">Responsável dos cards</span>
            {ownerSelect()}
          </label>
        </div>

        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 border-t border-line p-4">
        <button onClick={onCancel} className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink hover:bg-subtle">
          Cancelar
        </button>
        <button
          onClick={() => onImport(rows)}
          disabled={rows.length === 0 || busy}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Importar {rows.length > 0 ? `(${rows.length})` : ""}
        </button>
      </div>
    </>
  );
}
