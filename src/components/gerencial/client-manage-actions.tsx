"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Copy,
  Loader2,
  MessageCircle,
  Megaphone,
  Package,
  Plus,
  Users,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { RESPONSIBLE_ROLES, type ResponsibleRole } from "@/lib/data/operacao";
import { cn } from "@/lib/utils";

const FORMATS = ["Reels", "Feed", "Stories", "Carrossel"] as const;
const COMMON_SERVICES = ["Social", "Tráfego", "Design", "Copy", "UGC", "Site", "E-commerce"];

const btn =
  "inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-subtle";
const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-brand-400";

type Brief = {
  objetivo: string;
  tomDeVoz: string;
  publico: string;
  concorrentes: string;
  restricoes: string;
};

const fmtField = (v: string) => {
  const t = (v ?? "").trim();
  return t && t !== "—" ? t : "—";
};

/**
 * Ações de gestão da conta no topo da ficha (HUB): handoff de briefing pro
 * squad (Social/Performance), troca de responsáveis e edição de serviços/
 * entregáveis do mês. Reusa as APIs de operação já existentes (partial update).
 */
export function ClientManageActions({
  clientId,
  clientName,
  brief,
  services: initialServices,
  deliverablesText,
  responsibles: initialResponsibles,
  squadName,
}: {
  clientId: string;
  clientName: string;
  brief: Brief;
  services: string[];
  deliverablesText: string;
  responsibles: Record<string, string>;
  squadName: string;
}) {
  const router = useRouter();
  const [modal, setModal] = useState<null | "brief" | "resp" | "ops">(null);
  const [team, setTeam] = useState<string[]>([]);

  // Briefing (handoff)
  const [copiedArea, setCopiedArea] = useState<string | null>(null);

  // Responsáveis
  const [resp, setResp] = useState<Record<string, string>>(() => ({ ...initialResponsibles }));

  // Serviços & entregáveis
  const [services, setServices] = useState<string[]>(() => [...initialServices]);
  const [newService, setNewService] = useState("");
  const [dels, setDels] = useState<Record<string, number>>({});
  const [delsLoaded, setDelsLoaded] = useState(false);

  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Time: necessário para os selects de responsáveis.
  useEffect(() => {
    if (modal !== "resp" || team.length) return;
    fetch("/api/gerencial/team", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => Array.isArray(j?.team) && setTeam(j.team as string[]))
      .catch(() => {});
  }, [modal, team.length]);

  // Entregáveis por formato: carregados sob demanda ao abrir o modal.
  useEffect(() => {
    if (modal !== "ops" || delsLoaded) return;
    fetch(`/api/gerencial/client-deliverables?clientId=${clientId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const map: Record<string, number> = {};
        for (const dv of (j?.deliverables ?? []) as { format: string; monthlyQty: number }[]) {
          map[dv.format] = dv.monthlyQty;
        }
        setDels(map);
      })
      .catch(() => {})
      .finally(() => setDelsLoaded(true));
  }, [modal, delsLoaded, clientId]);

  function buildBrief(area: "social" | "performance") {
    const monthLabel = new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    const owner = area === "social" ? initialResponsibles.social : initialResponsibles.performance;
    const head = area === "social" ? "SOCIAL MEDIA / LINHA EDITORIAL" : "PERFORMANCE / TRÁFEGO";
    const lines = [
      `📋 Briefing · ${head} — ${clientName} (${monthLabel})`,
      ``,
      `Objetivo: ${fmtField(brief.objetivo)}`,
      `Público: ${fmtField(brief.publico)}`,
      ...(area === "social" ? [`Tom de voz: ${fmtField(brief.tomDeVoz)}`] : []),
      `Concorrentes/Referências: ${fmtField(brief.concorrentes)}`,
      `Restrições: ${fmtField(brief.restricoes)}`,
      ``,
      `Serviços contratados: ${initialServices.length ? initialServices.join(" · ") : "—"}`,
      ...(area === "social" ? [`Entregáveis do mês: ${deliverablesText || "—"}`] : []),
      `Responsável ${area === "social" ? "Social" : "Performance"}: ${owner?.trim() || "a definir"}`,
      `Squad: ${squadName || "—"}`,
    ];
    return lines.join("\n");
  }

  function copyBrief(area: "social" | "performance") {
    void navigator.clipboard?.writeText(buildBrief(area)).then(() => {
      setCopiedArea(area);
      window.setTimeout(() => setCopiedArea((a) => (a === area ? null : a)), 1800);
    });
  }

  const waShare = (area: "social" | "performance") =>
    `https://api.whatsapp.com/send?text=${encodeURIComponent(buildBrief(area))}`;

  function addService(name: string) {
    const v = name.trim();
    if (!v || services.includes(v)) return;
    setServices((s) => [...s, v]);
    setNewService("");
  }

  async function saveResp() {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/gerencial/client-operation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, responsibles: resp }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 1400);
      window.setTimeout(() => setModal(null), 500);
    } catch {
      toast("Não foi possível salvar os responsáveis.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function saveOps() {
    if (busy) return;
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/gerencial/client-operation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, services }),
      });
      if (!res.ok) throw new Error();
      await Promise.all(
        FORMATS.map((f) =>
          fetch("/api/gerencial/client-deliverables", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ clientId, format: f, monthlyQty: Number(dels[f] ?? 0) }),
          }),
        ),
      );
      setSaved(true);
      router.refresh();
      window.setTimeout(() => setSaved(false), 1400);
      window.setTimeout(() => setModal(null), 500);
    } catch {
      toast("Não foi possível salvar serviços/entregáveis.", "error");
    } finally {
      setBusy(false);
    }
  }

  const teamOptions = (current: string) => [...new Set([...team, current].filter(Boolean))];

  const saveBtn = (onClick: () => void) => (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        "ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60",
        saved ? "bg-emerald-600" : "bg-brand-600 hover:bg-brand-700",
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
      {saved ? "Salvo" : "Salvar"}
    </button>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setModal("brief")} className={btn}>
          <Megaphone className="h-3.5 w-3.5" /> Mandar briefing
        </button>
        <button onClick={() => setModal("resp")} className={btn}>
          <Users className="h-3.5 w-3.5" /> Responsáveis
        </button>
        <button onClick={() => setModal("ops")} className={btn}>
          <Package className="h-3.5 w-3.5" /> Serviços &amp; entregáveis
        </button>
      </div>

      {/* Briefing — handoff pro squad (Social + Performance) */}
      <Modal
        open={modal === "brief"}
        onClose={() => setModal(null)}
        title="Mandar briefing pro squad"
        description="Gerado do brief da marca + serviços e entregáveis do mês. Copie ou envie no grupo/WhatsApp do responsável."
        size="lg"
      >
        <div className="space-y-4">
          {(["social", "performance"] as const).map((area) => (
            <div key={area} className="rounded-xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink">
                  {area === "social" ? "Briefing · Social Media" : "Briefing · Performance / Tráfego"}
                </p>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => copyBrief(area)} className={btn}>
                    {copiedArea === area ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-500" /> Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" /> Copiar
                      </>
                    )}
                  </button>
                  <a
                    href={waShare(area)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 px-3 py-1.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/10"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </a>
                </div>
              </div>
              <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-lg bg-subtle px-3 py-2 text-xs leading-relaxed text-ink/90">
                {buildBrief(area)}
              </pre>
            </div>
          ))}
        </div>
      </Modal>

      {/* Responsáveis */}
      <Modal
        open={modal === "resp"}
        onClose={() => setModal(null)}
        title="Responsáveis pelo cliente"
        description="Quem toca cada função nesta conta."
        footer={saveBtn(saveResp)}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {RESPONSIBLE_ROLES.map((r) => {
            const key = r.key as ResponsibleRole;
            return (
              <label key={key} className="text-[11px] text-muted">
                {r.label}
                <select
                  value={resp[key] ?? ""}
                  onChange={(e) => setResp((s) => ({ ...s, [key]: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {teamOptions(resp[key] ?? "").map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            );
          })}
        </div>
      </Modal>

      {/* Serviços & entregáveis */}
      <Modal
        open={modal === "ops"}
        onClose={() => setModal(null)}
        title="Serviços & entregáveis do mês"
        description="Escopo contratado e o que a produção entrega no ciclo."
        footer={saveBtn(saveOps)}
      >
        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Serviços</p>
        {services.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {services.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-ink">
                {s}
                <button onClick={() => setServices((arr) => arr.filter((x) => x !== s))} className="text-muted hover:text-rose-500" aria-label={`Remover ${s}`}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addService(newService))}
            placeholder="Adicionar serviço"
            className="w-40 rounded-lg border border-line bg-surface px-2.5 py-1 text-xs text-ink outline-none focus:border-brand-400"
          />
          {COMMON_SERVICES.filter((s) => !services.includes(s)).map((s) => (
            <button key={s} onClick={() => addService(s)} className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-line px-2 py-0.5 text-[11px] text-muted hover:text-ink">
              <Plus className="h-3 w-3" /> {s}
            </button>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-[11px] font-bold uppercase tracking-wide text-muted">Entregáveis do mês</p>
        {!delsLoaded ? (
          <div className="flex items-center gap-2 py-3 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FORMATS.map((f) => (
              <label key={f} className="text-[11px] text-muted">
                {f}
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={dels[f] ?? 0}
                  onChange={(e) => setDels((d) => ({ ...d, [f]: Math.max(0, Number(e.target.value) || 0) }))}
                  className={inputCls}
                />
              </label>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
