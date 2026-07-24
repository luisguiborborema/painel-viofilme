"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  Calendar,
  ExternalLink,
  Mail,
  Package,
  Phone,
  Pin,
  Plus,
  Users,
} from "lucide-react";
import type { Company, Contact, CrmLead, Tag, TaskItem } from "@/lib/data/crm";
import {
  buildCompanyRows,
  buildPersonRows,
  COMPANY_FIELDS,
  PERSON_FIELDS,
  type CompanyRow,
  type PersonRow,
  type SavedView,
} from "@/lib/data/listas";
import type { KnowledgeCategory, KnowledgePageCard, ServiceCatalog } from "@/lib/data/listas-server";
import { ListaShell, type Col } from "./listas-shell";
import { NewContactModal } from "./new-contact-modal";
import { NewCompanyModal } from "./new-company-modal";
import { BulkTaskModal } from "./bulk-task-modal";

type Sub = "pessoas" | "empresas" | "produtos" | "processos";

function TagPills({ ids, tags }: { ids: string[]; tags: Tag[] }) {
  if (!ids?.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {ids.slice(0, 3).map((id) => {
        const t = tags.find((x) => x.id === id);
        if (!t) return null;
        return (
          <span
            key={id}
            style={{ backgroundColor: `${t.color}1f`, color: t.color }}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          >
            {t.name}
          </span>
        );
      })}
    </span>
  );
}

function DealBadges({ open, won }: { open: number; won: number }) {
  if (!open && !won) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {open > 0 && (
        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{open} aberto</span>
      )}
      {won > 0 && (
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{won} ganho</span>
      )}
    </span>
  );
}

function fmtDue(iso?: string): { label: string; tone: string } {
  if (!iso) return { label: "—", tone: "text-muted" };
  const d = new Date(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const label = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  if (diff < 0) return { label: `${label} (atrasada)`, tone: "text-red-600" };
  if (diff === 0) return { label: "Hoje", tone: "text-amber-600" };
  return { label, tone: "text-muted" };
}

function NextActivity({ iso }: { iso?: string }) {
  const { label, tone } = fmtDue(iso);
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${tone}`}>
      {iso && <Calendar className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
}

function Contactos({ email, phone }: { email?: string; phone?: string }) {
  if (!email && !phone) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      {email && <Mail className="h-3.5 w-3.5" />}
      {phone && <Phone className="h-3.5 w-3.5" />}
      <span className="truncate">{email ?? phone}</span>
    </span>
  );
}

export function CrmListas({
  contacts,
  companies,
  deals,
  tasks,
  tags,
  team,
  currentUser = "",
  savedViews,
  serviceCatalog,
  knowledge,
}: {
  contacts: Contact[];
  companies: Company[];
  deals: CrmLead[];
  tasks: TaskItem[];
  tags: Tag[];
  team: string[];
  currentUser?: string;
  savedViews: SavedView[];
  serviceCatalog: ServiceCatalog[];
  knowledge: { categories: KnowledgeCategory[]; pages: KnowledgePageCard[] };
}) {
  const router = useRouter();
  const [sub, setSub] = useState<Sub>("pessoas");
  const [newPerson, setNewPerson] = useState(false);
  const [newCompany, setNewCompany] = useState(false);
  const [taskTargets, setTaskTargets] = useState<{ scope: "pessoas" | "empresas"; ids: string[]; count: number } | null>(null);

  const personRows = useMemo(
    () => buildPersonRows(contacts, companies, deals, tasks),
    [contacts, companies, deals, tasks],
  );
  const companyRows = useMemo(
    () => buildCompanyRows(companies, contacts, deals, tasks),
    [companies, contacts, deals, tasks],
  );

  const personCols: Col<PersonRow>[] = [
    {
      key: "name",
      header: "Nome",
      sortKey: "name",
      cell: (r) => (
        <div>
          <div className="font-medium text-ink">{r.name}</div>
          {r.title && <div className="text-xs text-muted">{r.title}</div>}
        </div>
      ),
      csv: (r) => r.name,
    },
    { key: "company", header: "Empresa", sortKey: "company", cell: (r) => r.company || "—", csv: (r) => r.company, hideable: true },
    { key: "contato", header: "Contato", cell: (r) => <Contactos email={r.email} phone={r.phone} />, csv: (r) => r.email ?? r.phone ?? "", hideable: true },
    { key: "owner", header: "Responsável", sortKey: "owner", cell: (r) => r.owner || "—", csv: (r) => r.owner ?? "", hideable: true },
    { key: "deals", header: "Negócios", sortKey: "open", cell: (r) => <DealBadges open={r.open} won={r.won} />, csv: (r) => `${r.open} aberto / ${r.won} ganho`, hideable: true },
    { key: "next", header: "Próx. atividade", cell: (r) => <NextActivity iso={r.nextActivity} />, csv: (r) => r.nextActivity ?? "", hideable: true },
    { key: "tags", header: "Tags", cell: (r) => <TagPills ids={r.tags} tags={tags} />, csv: (r) => r.tags.join(", "), hideable: true },
  ];

  const companyCols: Col<CompanyRow>[] = [
    {
      key: "name",
      header: "Empresa",
      sortKey: "name",
      cell: (r) => (
        <div>
          <div className="font-medium text-ink">{r.name}</div>
          {r.website && <div className="text-xs text-muted">{r.website}</div>}
        </div>
      ),
      csv: (r) => r.name,
    },
    { key: "segment", header: "Segmento", sortKey: "segment", cell: (r) => r.segment || "—", csv: (r) => r.segment ?? "", hideable: true },
    { key: "city", header: "Cidade", sortKey: "city", cell: (r) => r.city || "—", csv: (r) => r.city ?? "", hideable: true },
    { key: "people", header: "Pessoas", sortKey: "people", align: "right", cell: (r) => (r.people ? r.people : "—"), csv: (r) => String(r.people), hideable: true },
    { key: "owner", header: "Responsável", sortKey: "owner", cell: (r) => r.owner || "—", csv: (r) => r.owner ?? "", hideable: true },
    { key: "deals", header: "Negócios", sortKey: "open", cell: (r) => <DealBadges open={r.open} won={r.won} />, csv: (r) => `${r.open} aberto / ${r.won} ganho`, hideable: true },
    { key: "next", header: "Próx. atividade", cell: (r) => <NextActivity iso={r.nextActivity} />, csv: (r) => r.nextActivity ?? "", hideable: true },
    { key: "tags", header: "Tags", cell: (r) => <TagPills ids={r.tags} tags={tags} />, csv: (r) => r.tags.join(", "), hideable: true },
  ];

  const TABS: { key: Sub; label: string; icon: typeof Users; count: number }[] = [
    { key: "pessoas", label: "Pessoas", icon: Users, count: contacts.length },
    { key: "empresas", label: "Empresas", icon: Building2, count: companies.length },
    { key: "produtos", label: "Produtos", icon: Package, count: serviceCatalog.length },
    { key: "processos", label: "Processos", icon: BookOpen, count: knowledge.pages.length },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-navegação das listas */}
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = sub === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setSub(t.key)}
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

      {sub === "pessoas" && (
        <ListaShell
          scope="pessoas"
          rows={personRows}
          fields={PERSON_FIELDS}
          columns={personCols}
          searchGet={(r) => `${r.name} ${r.company} ${r.email ?? ""} ${r.phone ?? ""} ${r.owner ?? ""}`}
          savedViews={savedViews}
          tags={tags}
          team={team}
          onBulkTask={(rows) => setTaskTargets({ scope: "pessoas", ids: rows.map((r) => r.id), count: rows.length })}
          onOpenRow={(r) => router.push(`/gerencial/crm/contato/${r.id}`)}
          newButton={
            <button
              type="button"
              onClick={() => setNewPerson(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" /> Pessoa
            </button>
          }
        />
      )}

      {sub === "empresas" && (
        <ListaShell
          scope="empresas"
          rows={companyRows}
          fields={COMPANY_FIELDS}
          columns={companyCols}
          searchGet={(r) => `${r.name} ${r.segment ?? ""} ${r.city ?? ""} ${r.owner ?? ""} ${r.cnpj ?? ""}`}
          savedViews={savedViews}
          tags={tags}
          team={team}
          onBulkTask={(rows) => setTaskTargets({ scope: "empresas", ids: rows.map((r) => r.id), count: rows.length })}
          onOpenRow={(r) => router.push(`/gerencial/crm/empresa/${r.id}`)}
          newButton={
            <button
              type="button"
              onClick={() => setNewCompany(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              <Plus className="h-4 w-4" /> Empresa
            </button>
          }
        />
      )}

      {sub === "produtos" && <ProdutosCasca services={serviceCatalog} />}
      {sub === "processos" && <ProcessosCasca knowledge={knowledge} />}

      {newPerson && <NewContactModal companies={companies} onClose={() => setNewPerson(false)} />}
      {newCompany && <NewCompanyModal onClose={() => setNewCompany(false)} />}
      {taskTargets && (
        <BulkTaskModal
          targetLabel={`${taskTargets.count} ${taskTargets.scope === "pessoas" ? "pessoa" : "empresa"}${taskTargets.count > 1 ? "s" : ""}`}
          count={taskTargets.count}
          team={team}
          currentUser={currentUser}
          contactIds={taskTargets.scope === "pessoas" ? taskTargets.ids : undefined}
          companyIds={taskTargets.scope === "empresas" ? taskTargets.ids : undefined}
          onClose={() => setTaskTargets(null)}
          onDone={() => { setTaskTargets(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

// ── Casca Produtos ───────────────────────────────────────────────────────────
function fmtBRL(cents?: number): string {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const DELIVERY_LABEL: Record<string, string> = {
  recorrente: "Recorrente",
  projeto: "Projeto",
  avulso: "Avulso",
};

function ProdutosCasca({ services }: { services: ServiceCatalog[] }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-ink">Catálogo de serviços · em construção</p>
        <p className="mt-1">
          A estrutura já existe (serviço › plano › pacote, com custo, receita e margem). A ficha rica do serviço, o
          montador de pacotes e a geração de proposta entram na próxima etapa.
        </p>
      </div>

      {services.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          Nenhum serviço cadastrado ainda.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {services.map((s) => (
            <div key={s.id} className="rounded-xl border border-line bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-ink">{s.name}</div>
                  {s.summary && <div className="text-xs text-muted">{s.summary}</div>}
                </div>
                <span className="shrink-0 rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">
                  {DELIVERY_LABEL[s.deliveryType] ?? s.deliveryType}
                </span>
              </div>
              {s.category && <div className="mt-1 text-[11px] uppercase tracking-wide text-brand-600">{s.category}</div>}
              <div className="mt-3 space-y-1.5">
                {s.plans.length === 0 && <p className="text-xs text-muted">Sem planos.</p>}
                {s.plans.map((p) => {
                  const margin = p.priceCents != null && p.costCents != null ? p.priceCents - p.costCents : undefined;
                  return (
                    <div key={p.id} className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2 text-sm">
                      <span className="text-ink">
                        {p.name} <span className="text-xs text-muted">· {p.cadence}</span>
                        {p.billingType === "midia_a_parte" && (
                          <span className="ml-1 text-[11px] text-amber-600">mídia à parte</span>
                        )}
                      </span>
                      <span className="text-right text-xs">
                        <span className="font-medium text-ink">{fmtBRL(p.priceCents)}</span>
                        {margin != null && <span className="ml-2 text-emerald-600">margem {fmtBRL(margin)}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Casca Processos ──────────────────────────────────────────────────────────
function ProcessosCasca({ knowledge }: { knowledge: { categories: KnowledgeCategory[]; pages: KnowledgePageCard[] } }) {
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const pages = knowledge.pages.filter((p) => {
    if (cat && p.categoryId !== cat) return false;
    const term = q.trim().toLowerCase();
    if (term && !(`${p.title} ${p.summary ?? ""} ${p.tags.join(" ")}`.toLowerCase().includes(term))) return false;
    return true;
  });
  const catById = (id?: string) => knowledge.categories.find((c) => c.id === id);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-dashed border-line bg-surface p-4 text-sm text-muted">
        <p className="font-medium text-ink">Base de conhecimento · em construção</p>
        <p className="mt-1">
          Mural de processos e playbooks por categoria. O editor rico (texto, arquivos, links, vídeo) e a ligação com
          scripts/cadências entram na próxima etapa. As categorias abaixo já estão prontas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setCat("")}
          className={`rounded-full border px-3 py-1 text-xs ${cat === "" ? "border-brand-500 bg-brand-500 text-white" : "border-line text-muted hover:text-ink"}`}
        >
          Todas
        </button>
        {knowledge.categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setCat(c.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
              cat === c.id ? "border-brand-500 bg-brand-500 text-white" : "border-line text-muted hover:text-ink"
            }`}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
            {c.name}
            <span className="opacity-70">{c.count}</span>
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar processo…"
          className="ml-auto w-56 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-brand-400"
        />
      </div>

      {pages.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          Nenhum processo publicado ainda. As categorias estão prontas para receber os cards.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => {
            const c = catById(p.categoryId);
            return (
              <div key={p.id} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {c && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />}
                    <span className="font-medium text-ink">{p.title}</span>
                  </div>
                  {p.pinned && <Pin className="h-3.5 w-3.5 text-amber-500" />}
                </div>
                {p.summary && <p className="mt-1 line-clamp-3 text-sm text-muted">{p.summary}</p>}
                {p.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.tags.slice(0, 4).map((t) => (
                      <span key={t} className="rounded-full bg-black/5 px-2 py-0.5 text-[11px] text-muted">
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 inline-flex items-center gap-1 text-xs text-brand-600">
                  Abrir <ExternalLink className="h-3 w-3" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
