"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BellOff, Check, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { GRAVIDADE_LABEL, type Excecao, type Gravidade } from "@/lib/data/dashboard-financeiro";
import type { DashboardFinanceiro } from "@/lib/data/dashboard-financeiro-server";

/**
 * Bloco 1 — Precisa da sua atenção (spec §5).
 *
 * A lista é de exceções DERIVADAS: cada linha é uma consulta sobre o estado
 * atual e some sozinha quando o problema é resolvido. Por isso não há botão de
 * "dispensar" em crítico nem em atenção (§5.3 regra 3) — só os avisos ⚪ podem
 * ser silenciados, e por sete dias.
 */

const PONTO: Record<Gravidade, string> = {
  critico: "bg-rose-500",
  atencao: "bg-amber-500",
  aviso: "bg-slate-400",
};

const SELO: Record<Gravidade, string> = {
  critico: "bg-rose-500/15 text-rose-600",
  atencao: "bg-amber-500/15 text-amber-600",
  aviso: "bg-subtle text-muted",
};

export function DashboardAtencao({ dados }: { dados: DashboardFinanceiro }) {
  const { principais, avisos, totalPrincipais } = dados.excecoes;
  const [abertos, setAbertos] = useState(false);

  return (
    <Card data-tour="fin-dash-atencao" className="overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 pb-3 pt-4">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold text-ink">Precisa da sua atenção</h2>
          {totalPrincipais > 0 && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-semibold text-rose-600">
              {totalPrincipais}
            </span>
          )}
        </div>
        <span className="text-xs text-muted">Atualizado às {dados.atualizadoEm}</span>
      </div>

      {totalPrincipais === 0 ? (
        <TudoEmDia dados={dados} />
      ) : (
        <ul className="m-0 list-none p-0">
          {principais.map((e) => (
            <li key={e.chave} className="border-t border-line">
              <Link
                href={e.href}
                className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-subtle"
              >
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", PONTO[e.gravidade])} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">{e.titulo}</span>
                  <span className="block truncate text-xs text-muted">{e.detalhe}</span>
                </span>
                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline",
                    SELO[e.gravidade],
                  )}
                >
                  {GRAVIDADE_LABEL[e.gravidade]}
                </span>
                <span className="hidden shrink-0 text-xs text-muted lg:inline">{e.destino}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {avisos.length > 0 && (
        <div className="border-t border-line">
          <button
            type="button"
            onClick={() => setAbertos((v) => !v)}
            aria-expanded={abertos}
            className="flex w-full items-center gap-2 px-5 py-2.5 text-xs font-medium text-muted transition-colors hover:text-ink"
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", !abertos && "-rotate-90")} />
            {abertos
              ? "Ocultar avisos"
              : `${avisos.length} ${avisos.length === 1 ? "aviso" : "avisos"}`}
          </button>
          {abertos && (
            <ul className="m-0 list-none space-y-0.5 p-0 pb-2">
              {avisos.map((a) => (
                <LinhaAviso key={a.chave} aviso={a} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}

/** §5.3 regra 7: sem 🔴 nem 🟠, a tela mostra o que já está resolvido. */
function TudoEmDia({ dados }: { dados: DashboardFinanceiro }) {
  const { ultimaConciliacao, proximaSaida } = dados.tudoEmDia;
  const partes = [
    ultimaConciliacao ? `Última conciliação em ${ultimaConciliacao}.` : null,
    proximaSaida ? `Próxima saída relevante: ${proximaSaida}.` : null,
  ].filter(Boolean);

  return (
    <div className="flex items-center gap-4 border-t border-line px-5 py-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
        <Check className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-base font-semibold text-ink">Tudo em dia</p>
        <p className="text-sm text-muted">
          {partes.length ? partes.join(" ") : "Nada vencido, nada para conciliar."}
        </p>
      </div>
    </div>
  );
}

function LinhaAviso({ aviso }: { aviso: Excecao }) {
  const router = useRouter();
  const [enviando, iniciar] = useTransition();
  const [silenciado, setSilenciado] = useState(false);

  async function silenciar() {
    const res = await fetch("/api/gerencial/dashboard-financeiro/silenciar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chave: aviso.chave }),
    }).catch(() => null);
    const erro = !res?.ok
      ? ((await res?.json().catch(() => null))?.error ?? "Não foi possível silenciar o aviso.")
      : null;
    if (erro) {
      toast(erro);
      return;
    }
    setSilenciado(true);
    toast("Aviso silenciado por 7 dias.", "success");
    iniciar(() => router.refresh());
  }

  if (silenciado) return null;

  return (
    <li className="flex items-center gap-3 px-5 py-2">
      <span className="h-2 w-2 shrink-0 rounded-full bg-slate-400" />
      <span className="min-w-0 flex-1">
        <span className="text-sm text-ink">{aviso.titulo}</span>{" "}
        <span className="text-xs text-muted">{aviso.detalhe}</span>
      </span>
      <Link href={aviso.href} className="shrink-0 text-xs font-medium text-brand-600 hover:underline">
        {aviso.destino}
      </Link>
      <button
        type="button"
        onClick={silenciar}
        disabled={enviando}
        className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted transition-colors hover:text-ink disabled:opacity-50"
      >
        <BellOff className="h-3.5 w-3.5" />
        Silenciar 7 dias
      </button>
    </li>
  );
}
