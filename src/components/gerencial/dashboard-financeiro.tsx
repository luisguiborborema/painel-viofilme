"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDownToLine, Check, ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { brlCheio } from "@/lib/data/dashboard-financeiro";
import type { DashboardFinanceiro, PassoImplantacao } from "@/lib/data/dashboard-financeiro-server";
import { DashboardAtencao } from "./dashboard-atencao";
import { DashboardPulso } from "./dashboard-pulso";
import { DashboardFluxo } from "./dashboard-fluxo";
import { DashboardSemana } from "./dashboard-semana";
import { DashboardPanorama } from "./dashboard-panorama";
import { DashboardFicha, type AlvoFicha } from "./dashboard-ficha";

/**
 * Dashboard Financeiro (spec §3): cabeçalho, faixa "Desde ontem" e os cinco
 * blocos. A ordem vai do operacional para o gerencial: quem opera resolve o
 * dia no topo, quem só quer saber como está desce até o Panorama.
 *
 * A ficha universal e a baixa rápida moram aqui, e não dentro do Bloco 4, por
 * serem overlays da PÁGINA: qualquer lista do Financeiro vai abrir a mesma
 * ficha, e ela precisa sobreviver a quem a abriu.
 */
export function DashboardFinanceiroView({
  dados,
  podeAgir,
}: {
  dados: DashboardFinanceiro;
  podeAgir: boolean;
}) {
  const router = useRouter();
  const [ficha, setFicha] = useState<AlvoFicha | null>(null);
  const [, revalidar] = useTransition();

  // A página é revalidada depois de qualquer ação feita nela (§15).
  const recarregar = () => revalidar(() => router.refresh());

  if (dados.primeiroUso.ativo) {
    return (
      <div className="space-y-6">
        <Cabecalho dados={dados} podeAgir={podeAgir} />
        <Implantacao dados={dados} />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <Cabecalho dados={dados} podeAgir={podeAgir} />
        {dados.desdeOntem && <FaixaDesdeOntem dados={dados} />}
      </div>

      {dados.semDados ? (
        <Aviso
          titulo="Sem conexão com o banco"
          texto="O Dashboard lê dados reais e não mostra exemplo no lugar deles. Configure o Supabase e recarregue."
        />
      ) : (
        <>
          {dados.pendente && (
            <Aviso
              titulo="Falta rodar a migração."
              texto="O Dashboard usa 0148_dashboard_financeiro.sql, que traz os parâmetros de §13, as flags da conta e o silêncio dos avisos. Sem ela a página funciona com os padrões, mas silenciar aviso não grava."
            />
          )}

          <div className="space-y-4">
            <DashboardAtencao dados={dados} />
            <DashboardPulso dados={dados} />
          </div>

          <DashboardFluxo dados={dados} />

          <DashboardSemana
            dados={dados}
            onAbrirFicha={podeAgir ? setFicha : () => setFicha(null)}
            onMudou={recarregar}
          />

          <DashboardPanorama dados={dados} />

          {ficha && (
            <DashboardFicha
              key={`${ficha.direcao}-${ficha.id}`}
              alvo={ficha}
              onFechar={() => setFicha(null)}
              onMudou={recarregar}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── Primeiro uso (§11) ────────────────────────────────────────────────── */

/**
 * Enquanto faltar conta com saldo ou receita recorrente, os blocos dariam
 * zero em tudo — e zero em tudo se parece com empresa quebrada, não com
 * implantação pela metade. O checklist toma o lugar deles.
 */
function Implantacao({ dados }: { dados: DashboardFinanceiro }) {
  const { passos, feitos } = dados.primeiroUso;
  return (
    <section
      aria-label="Implantação"
      className="space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-xl">
          <h2 className="text-xl font-semibold tracking-tight text-ink">Vamos preparar o financeiro</h2>
          <p className="mt-1 text-sm text-muted">
            Saldo, projeção de caixa, receita e resultado aparecem aqui assim que as contas e as
            recorrências de receita estiverem cadastradas.
          </p>
        </div>
        <span className="text-sm text-muted">{feitos} de {passos.length} concluídos</span>
      </div>

      <div className="h-1.5 overflow-hidden rounded-full bg-subtle-strong">
        <div className="h-full bg-brand-500" style={{ width: `${(feitos / passos.length) * 100}%` }} />
      </div>

      <ol className="m-0 list-none space-y-2 p-0">
        {passos.map((p) => (
          <PassoLinha key={p.n} passo={p} />
        ))}
      </ol>
    </section>
  );
}

function PassoLinha({ passo }: { passo: PassoImplantacao }) {
  return (
    <li className="flex items-center gap-4 rounded-xl border border-line bg-subtle px-4 py-3">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          passo.feito
            ? "bg-emerald-500/15 text-emerald-600"
            : "border border-line text-muted",
        )}
      >
        {passo.feito ? <Check className="h-3.5 w-3.5" /> : passo.n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{passo.titulo}</p>
        <p className="text-xs text-muted">{passo.detalhe}</p>
      </div>
      {!passo.feito && (
        <Link
          href={passo.href}
          className="h-9 shrink-0 rounded-xl border border-line bg-surface px-3.5 text-sm font-medium leading-9 text-ink transition-colors hover:bg-subtle-strong"
        >
          Começar
        </Link>
      )}
    </li>
  );
}

/* ── Cabeçalho (§4) ────────────────────────────────────────────────────── */

function Cabecalho({ dados, podeAgir }: { dados: DashboardFinanceiro; podeAgir: boolean }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs text-muted">Financeiro</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">{dados.dataLabel}</p>
      </div>
      <div className="flex items-center gap-2">
        {dados.podeImportarExtrato && (
          <Link
            href="/gerencial/financeiro?aba=conciliacao"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand-300"
          >
            <ArrowDownToLine className="h-4 w-4" />
            Importar extrato
          </Link>
        )}
        {podeAgir && <MenuNovo />}
      </div>
    </header>
  );
}

const NOVO = [
  {
    href: "/gerencial/financeiro?aba=receber&novo=1",
    titulo: "Receita",
    desc: "Conta a receber ou cobrança",
  },
  {
    href: "/gerencial/financeiro?aba=pagar&novo=1",
    titulo: "Despesa",
    desc: "Conta a pagar, única ou parcelada",
  },
  {
    href: "/gerencial/financeiro?aba=contas",
    titulo: "Transferência",
    desc: "Entre contas da agência",
  },
];

function MenuNovo() {
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!caixa.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
      >
        <Plus className="h-4 w-4" />
        Novo
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", aberto && "rotate-180")} />
      </button>
      {aberto && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-64 rounded-2xl border border-line bg-surface p-1.5 shadow-lg">
          {NOVO.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setAberto(false)}
              className="flex flex-col gap-0.5 rounded-xl px-3 py-2.5 transition-colors hover:bg-subtle"
            >
              <span className="text-sm font-semibold text-ink">{n.titulo}</span>
              <span className="text-xs text-muted">{n.desc}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Faixa "Desde ontem" (§4) ──────────────────────────────────────────── */

function FaixaDesdeOntem({ dados }: { dados: DashboardFinanceiro }) {
  const d = dados.desdeOntem;
  if (!d) return null;
  const separador = <span className="h-3.5 w-px bg-line" />;

  return (
    <Link
      href={d.href}
      className="inline-flex flex-wrap items-center gap-3 self-start rounded-full border border-line bg-subtle px-4 py-2 text-xs text-muted transition-colors hover:text-ink"
    >
      <span className="font-semibold text-ink">{d.label}</span>
      <span>
        <span className="text-emerald-600">
          {d.entradas.qtd} {d.entradas.qtd === 1 ? "recebimento" : "recebimentos"}
        </span>{" "}
        somando {brlCheio(d.entradas.valorCent)}
      </span>
      {separador}
      <span>
        {d.saidas.qtd} {d.saidas.qtd === 1 ? "pagamento" : "pagamentos"} somando{" "}
        {brlCheio(d.saidas.valorCent)}
      </span>
      {d.destaque && (
        <>
          {separador}
          <span>{d.destaque}</span>
        </>
      )}
    </Link>
  );
}

/* ── Avisos de estado ──────────────────────────────────────────────────── */

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-ink">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 text-muted">{texto}</p>
    </div>
  );
}

