"use client";

import { useState } from "react";
import { CheckCircle2, Copy, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { PlatformIcon } from "@/components/dashboard/platform";
import { usePersistentState } from "@/lib/use-persistent-state";
import { cn } from "@/lib/utils";
import type { Client, Platform } from "@/lib/data/types";

type ClientType = Client["clientType"];

type Config = {
  hasPaidTraffic: boolean;
  clientType: ClientType;
  activeNetworks: Platform[];
  asaasCustomerId: string;
  whatsapp: string;
};

const CLIENT_TYPES: { value: ClientType; label: string; hint: string }[] = [
  { value: "lead_gen", label: "Geração de leads", hint: "Foco em cadastros / CPL" },
  { value: "ecommerce", label: "E-commerce", hint: "Foco em vendas / ROAS" },
  { value: "local_business", label: "Negócio local", hint: "Foco em alcance / visitas" },
];

const NETWORKS: Platform[] = ["instagram", "facebook"];
const NETWORK_LABEL: Record<Platform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

export function ClientConfigCard({
  clientId,
  initial,
}: {
  clientId: string;
  initial: Config;
}) {
  const [cfg, setCfg] = usePersistentState<Config>(
    `vio-client-config-${clientId}`,
    initial,
  );
  const [saved, setSaved] = usePersistentState<boolean>(
    `vio-client-config-saved-${clientId}`,
    false,
  );
  const [linkCopied, setLinkCopied] = useState(false);

  function patch(p: Partial<Config>) {
    setCfg({ ...cfg, ...p });
    setSaved(false);
  }

  function toggleNetwork(n: Platform) {
    const has = cfg.activeNetworks.includes(n);
    // mantém ao menos uma rede ativa
    if (has && cfg.activeNetworks.length === 1) return;
    patch({
      activeNetworks: has
        ? cfg.activeNetworks.filter((x) => x !== n)
        : [...cfg.activeNetworks, n],
    });
  }

  async function save() {
    // Persiste no Supabase (produção). No modo demo, mantém em localStorage.
    try {
      await fetch("/api/gerencial/client-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, ...cfg }),
      });
    } catch {
      // silencioso — o localStorage já guardou o estado
    }
    setSaved(true);
  }

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-brand-300" />
        <h2 className="text-sm font-semibold text-ink">Configuração do portal</h2>
      </div>
      <p className="mb-4 text-xs text-muted">
        Controla a Home (coluna direita), o módulo de Campanhas e os cards de
        rede em Resultados.
      </p>

      <div className="space-y-5">
        {/* Tráfego pago (R05) */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-ink">Tem tráfego pago?</p>
            <p className="text-xs text-muted">
              Define se a Home mostra orçamento de mídia ou bloco orgânico.
            </p>
          </div>
          <button
            role="switch"
            aria-checked={cfg.hasPaidTraffic}
            onClick={() => patch({ hasPaidTraffic: !cfg.hasPaidTraffic })}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              cfg.hasPaidTraffic ? "bg-brand-500" : "bg-subtle-strong",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
                cfg.hasPaidTraffic ? "translate-x-[22px]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>

        {/* Tipo de negócio (CAM04) */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Tipo de negócio</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {CLIENT_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => patch({ clientType: t.value })}
                className={cn(
                  "rounded-xl border p-3 text-left transition-colors",
                  cfg.clientType === t.value
                    ? "border-brand-400 bg-brand-500/10"
                    : "border-line bg-subtle hover:border-brand-300",
                )}
              >
                <p className="text-sm font-medium text-ink">{t.label}</p>
                <p className="text-xs text-muted">{t.hint}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Redes ativas (ORG06) */}
        <div>
          <p className="mb-2 text-sm font-medium text-ink">Redes ativas</p>
          <div className="flex flex-wrap gap-2">
            {NETWORKS.map((n) => {
              const active = cfg.activeNetworks.includes(n);
              return (
                <button
                  key={n}
                  onClick={() => toggleNetwork(n)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-brand-400 bg-brand-500/10 text-ink"
                      : "border-line bg-subtle text-muted hover:text-ink",
                  )}
                >
                  <PlatformIcon platform={n} className="h-4 w-4" />
                  {NETWORK_LABEL[n]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Vínculo Asaas (financeiro) */}
        <div>
          <p className="mb-1 text-sm font-medium text-ink">ID do cliente no Asaas</p>
          <p className="mb-2 text-xs text-muted">
            Vincula os pagamentos recebidos via webhook a este cliente (ex.:
            <code className="mx-1">cus_000012345</code>).
          </p>
          <input
            value={cfg.asaasCustomerId ?? ""}
            onChange={(e) => patch({ asaasCustomerId: e.target.value })}
            placeholder="cus_..."
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>

        {/* WhatsApp do cliente (notificações Uazapi) */}
        <div>
          <p className="mb-1 text-sm font-medium text-ink">WhatsApp do cliente</p>
          <p className="mb-2 text-xs text-muted">
            Destino das notificações por WhatsApp (com DDI/DDD, ex.:
            <code className="mx-1">5527999998888</code>).
          </p>
          <input
            value={cfg.whatsapp ?? ""}
            onChange={(e) => patch({ whatsapp: e.target.value })}
            placeholder="5527999998888"
            className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button
          onClick={save}
          className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          Salvar configuração
        </button>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(`${window.location.origin}/cliente`).then(() => {
              setLinkCopied(true);
              window.setTimeout(() => setLinkCopied(false), 1800);
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle"
        >
          {linkCopied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
          {linkCopied ? "Link copiado" : "Copiar link do cliente"}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Configuração salva
          </span>
        )}
      </div>
    </Card>
  );
}
