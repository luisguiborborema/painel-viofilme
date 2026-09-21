import { CalendarClock } from "lucide-react";
import { getPlanejamento } from "@/lib/data/planejamento-server";
import { getPlanejamentoFuturo } from "@/lib/data/planejamento-futuro-server";
import { PlanejamentoTabs } from "@/components/gerencial/planejamento-tabs";

export const metadata = { title: "Planejamento" };
export const dynamic = "force-dynamic";

export default async function PlanejamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; per?: string }>;
}) {
  const sp = await searchParams;
  const acumulado = sp.per === "acum";
  const mes = Number(sp.mes) || undefined;
  // As duas leituras são independentes: Orçamento olha o passado contra o
  // plano, Projeção e Cenários olham para frente pelo motor de simulação.
  const [d, futuro] = await Promise.all([
    getPlanejamento({ mes, acumulado }),
    getPlanejamentoFuturo(),
  ]);

  return (
    <div className="space-y-5">
      {/* Cabeçalho: módulo, título, versão vigente e a ação do ciclo. */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs text-muted">Financeiro</p>
          <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Planejamento</h1>
          <p className="mt-1 text-sm text-muted">
            O plano do ano, para onde estamos indo e o que acontece se algo mudar.
          </p>
        </div>
        <span className="text-xs text-muted">{d.versaoLabel}</span>
      </header>

      {d.pendente ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-ink">
          <p className="font-medium">Falta rodar a migração.</p>
          <p className="mt-1 text-muted">
            O Planejamento precisa de <code>0146_planejamento.sql</code>. Rode no Supabase e recarregue.
          </p>
        </div>
      ) : (
        <>
          {/* Faixa da rotina: um único próximo passo (spec 4). */}
          <div
            className={
              d.rotina.acao
                ? "flex flex-wrap items-center gap-3 rounded-xl border border-brand-400/40 bg-brand-500/[0.07] px-4 py-3"
                : "flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3"
            }
          >
            <span
              className={
                d.rotina.acao
                  ? "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-600"
                  : "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600"
              }
            >
              <CalendarClock className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{d.rotina.titulo}</span>
              <span className="block text-xs text-muted">{d.rotina.subtitulo}</span>
            </span>
            <span className="hidden gap-4 text-[11px] text-muted lg:flex">
              <span>Anual: novembro</span>
              <span>Mensal: após o fechamento</span>
              <span>Trimestral: set, dez, mar, jun</span>
            </span>
          </div>

          <PlanejamentoTabs dados={d} futuro={futuro} acumulado={acumulado} />
        </>
      )}
    </div>
  );
}
