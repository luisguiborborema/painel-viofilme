"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  FileBarChart,
  FileText,
  FolderOpen,
  Gauge,
  Loader2,
  Mail,
  MessageCircle,
  Settings2,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { NpsConfigModal } from "@/components/gerencial/nps-config-modal";

type CaptureFormItem = { id: string; name: string; slug: string; destination: string };

/**
 * Ações Rápidas — Grupo 1 (head do cliente). Sem RBAC: só ações universais.
 * "Drive/Pasta de ativos" é casca (placeholder) até a integração ligar.
 */
export function ClientQuickActions({
  clientId,
  whatsapp,
  driveUrl,
}: {
  clientId: string;
  whatsapp?: string | null;
  driveUrl?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [formsOpen, setFormsOpen] = useState(false);
  const [forms, setForms] = useState<CaptureFormItem[] | null>(null);
  const [copiedForm, setCopiedForm] = useState<string | null>(null);
  const wa = whatsapp?.replace(/\D/g, "");

  // NPS por link
  const [npsOpen, setNpsOpen] = useState(false);
  const [npsBusy, setNpsBusy] = useState(false);
  const [npsCopied, setNpsCopied] = useState(false);
  const [nps, setNps] = useState<{ token: string; whatsapp: string; email: string } | null>(null);
  const [npsCfgOpen, setNpsCfgOpen] = useState(false);

  async function toggleNps() {
    const next = !npsOpen;
    setNpsOpen(next);
    if (next && !nps && !npsBusy) {
      setNpsBusy(true);
      try {
        const res = await fetch("/api/gerencial/nps", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "invite", clientId, channel: "manual" }),
        });
        const j = await res.json().catch(() => null);
        if (!res.ok || !j?.token) {
          toast(j?.error ?? "Não foi possível gerar o link do NPS.", "error");
          setNpsOpen(false);
        } else {
          setNps({ token: j.token, whatsapp: (j.whatsapp || whatsapp || "").replace(/\D/g, ""), email: j.email || "" });
        }
      } finally {
        setNpsBusy(false);
      }
    }
  }

  const npsLink = () => (nps ? `${window.location.origin}/nps/${nps.token}` : "");
  const npsMsg = () => `Oi! Sua opinião é muito importante pra gente. Pode responder nossa pesquisa rápida de satisfação? Leva menos de 1 minuto: ${npsLink()}`;
  function copyNps() {
    void navigator.clipboard?.writeText(npsLink()).then(() => {
      setNpsCopied(true);
      window.setTimeout(() => setNpsCopied(false), 1800);
    });
  }

  const base =
    "inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-subtle";

  function copyLink() {
    void navigator.clipboard
      ?.writeText(`${window.location.origin}/gerencial/clientes/${clientId}`)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      });
  }

  function toggleForms() {
    const next = !formsOpen;
    setFormsOpen(next);
    if (next && forms === null) {
      fetch("/api/crm/capture-forms?list=1")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => setForms((j?.forms as CaptureFormItem[]) ?? []))
        .catch(() => setForms([]));
    }
  }

  const formLink = (slug: string) =>
    `${window.location.origin}/captura/${slug}?client=${clientId}`;

  function copyForm(slug: string) {
    void navigator.clipboard?.writeText(formLink(slug)).then(() => {
      setCopiedForm(slug);
      window.setTimeout(() => setCopiedForm((c) => (c === slug ? null : c)), 1800);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href="/cliente"
        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-600"
      >
        <ExternalLink className="h-3.5 w-3.5" /> Abrir portal do cliente
      </a>
      <button onClick={copyLink} className={base}>
        {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "Link copiado" : "Copiar link"}
      </button>

      {/* Enviar formulário vinculado a este cliente */}
      <div className="relative">
        <button onClick={toggleForms} className={base}>
          <FileText className="h-3.5 w-3.5" /> Enviar formulário
          <ChevronDown className={`h-3 w-3 transition-transform ${formsOpen ? "rotate-180" : ""}`} />
        </button>
        {formsOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setFormsOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Enviar ao cliente — cria o card já vinculado
              </p>
              {forms === null ? (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                </div>
              ) : forms.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted">Nenhum formulário ativo. Crie um em Comercial › Configurações.</p>
              ) : (
                forms.map((f) => (
                  <div key={f.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-subtle">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">{f.name}</span>
                      <span className="text-[10px] text-muted">{f.destination === "entregas" ? "→ Tarefa" : "→ Negócio"}</span>
                    </span>
                    <button
                      onClick={() => copyForm(f.slug)}
                      className="shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-600 hover:bg-brand-500/10"
                    >
                      {copiedForm === f.slug ? "copiado" : "copiar link"}
                    </button>
                    {wa && (
                      <a
                        href={`https://wa.me/${wa}?text=${encodeURIComponent(`Segue o formulário para preencher: ${formLink(f.slug)}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar no WhatsApp"
                        className="shrink-0 rounded-md p-1 text-emerald-600 hover:bg-emerald-500/10"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
      {/* Enviar pesquisa de NPS (link estilo Tally) */}
      <div className="relative">
        <button onClick={toggleNps} className={base}>
          <Gauge className="h-3.5 w-3.5" /> Enviar NPS
          <ChevronDown className={`h-3 w-3 transition-transform ${npsOpen ? "rotate-180" : ""}`} />
        </button>
        {npsOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setNpsOpen(false)} />
            <div className="absolute left-0 z-20 mt-1 w-72 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
              <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                Pesquisa de satisfação — link único
              </p>
              {npsBusy || !nps ? (
                <div className="flex items-center gap-2 px-2 py-3 text-xs text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando link…
                </div>
              ) : (
                <div className="space-y-0.5">
                  <button
                    onClick={copyNps}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-subtle"
                  >
                    {npsCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5 text-muted" />}
                    {npsCopied ? "Link copiado" : "Copiar link"}
                  </button>
                  {nps.whatsapp ? (
                    <a
                      href={`https://wa.me/${nps.whatsapp}?text=${encodeURIComponent(npsMsg())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setNpsOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-subtle"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" /> Enviar no WhatsApp
                    </a>
                  ) : (
                    <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted">
                      <MessageCircle className="h-3.5 w-3.5" /> Sem WhatsApp cadastrado
                    </span>
                  )}
                  <a
                    href={`mailto:${nps.email}?subject=${encodeURIComponent("Pesquisa de satisfação — Viofilme")}&body=${encodeURIComponent(npsMsg())}`}
                    onClick={() => setNpsOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-ink hover:bg-subtle"
                  >
                    <Mail className="h-3.5 w-3.5 text-brand-600" /> Enviar por e-mail
                  </a>
                </div>
              )}
              <div className="mt-1 border-t border-line pt-1">
                <button
                  onClick={() => { setNpsOpen(false); setNpsCfgOpen(true); }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-muted hover:bg-subtle hover:text-ink"
                >
                  <Settings2 className="h-3.5 w-3.5" /> Personalizar perguntas
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      {npsCfgOpen && <NpsConfigModal onClose={() => setNpsCfgOpen(false)} />}

      <a
        href={`/api/relatorio/pdf?clientId=${clientId}`}
        target="_blank"
        rel="noopener noreferrer"
        className={base}
        title="Relatório mensal de resultados (PDF)"
      >
        <FileBarChart className="h-3.5 w-3.5" /> Relatório do mês
      </a>
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          className={base}
        >
          <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
        </a>
      )}
      {driveUrl ? (
        <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={base}>
          <FolderOpen className="h-3.5 w-3.5" /> Drive de ativos
        </a>
      ) : (
        <span
          title="Cadastre o link da pasta em Contatos & briefing"
          className={`${base} cursor-default opacity-60`}
        >
          <FolderOpen className="h-3.5 w-3.5" /> Drive de ativos
        </span>
      )}
    </div>
  );
}
