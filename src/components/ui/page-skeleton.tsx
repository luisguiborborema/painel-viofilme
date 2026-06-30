/**
 * Esqueleto genérico de página — exibido instantaneamente durante a navegação
 * (via loading.tsx) enquanto o conteúdo do servidor é carregado.
 */
export function PageSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Cabeçalho */}
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-lg bg-subtle-strong" />
        <div className="h-4 w-80 max-w-full rounded bg-subtle" />
      </div>

      {/* Linha de cards de métrica */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface p-4">
            <div className="h-3 w-24 rounded bg-subtle" />
            <div className="mt-3 h-7 w-20 rounded bg-subtle-strong" />
            <div className="mt-2 h-3 w-28 rounded bg-subtle" />
          </div>
        ))}
      </div>

      {/* Bloco principal (gráfico + lateral) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface p-5 lg:col-span-2">
          <div className="h-4 w-40 rounded bg-subtle" />
          <div className="mt-4 h-[240px] rounded-xl bg-subtle" />
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="h-4 w-32 rounded bg-subtle" />
          <div className="mt-4 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 rounded-lg bg-subtle" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
