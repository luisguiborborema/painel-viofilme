import { getResultados } from "@/lib/data/resultados-server";
import { ResultadosTabs } from "@/components/gerencial/resultados-tabs";

export const metadata = { title: "Resultados" };
export const dynamic = "force-dynamic";

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ano?: string }>;
}) {
  const sp = await searchParams;
  const d = await getResultados({ mes: Number(sp.mes) || undefined, ano: Number(sp.ano) || undefined });

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs text-muted">Financeiro</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Resultados</h1>
        <p className="mt-1 text-sm text-muted">
          Onde estamos ganhando e perdendo dinheiro. Tudo por competência.
        </p>
      </header>

      {d.pendente ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-ink">
          <p className="font-medium">Falta rodar a migração.</p>
          <p className="mt-1 text-muted">
            Resultados precisa de <code>0147_resultados.sql</code>, que traz o tipo de impacto das
            categorias. Rode no Supabase e recarregue.
          </p>
        </div>
      ) : (
        <ResultadosTabs dados={d} />
      )}
    </div>
  );
}
