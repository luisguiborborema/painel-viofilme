"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowLeftRight, Check, Plus, Search, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio } from "@/lib/data/dashboard-financeiro";
import type {
  CaixaView as Dados, CartaoConta, ItemDaFila, LinhaDaTabela,
} from "@/lib/data/caixa-server";
import { AcoesDaFila, ModalImportar, ModalMovimentacao, ModalTransferencia } from "./caixa-acoes";

/**
 * Caixa (spec da página 4) — o dinheiro que se moveu e o que vai se mover.
 *
 * A página tem duas naturezas: gerencial ("vou ter dinheiro?") e de controle
 * ("o que está no sistema bate com o banco?"). A segunda é a que sustenta a
 * primeira — com saldo divergente, nenhum número das outras páginas vale.
 *
 * Nada é calculado aqui: alturas do gráfico, estado da conta, sugestão de
 * conciliação e saldo corrido chegam prontos.
 */

const TOM: Record<string, string> = {
  ok: "text-emerald-600",
  ruim: "text-rose-600",
  atencao: "text-amber-600",
  info: "text-sky-600",
  roxo: "text-violet-600",
  neutro: "text-muted",
};

const TOM_CHIP: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  ruim: "bg-rose-500/15 text-rose-600",
  atencao: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  roxo: "bg-violet-500/15 text-violet-600",
  neutro: "bg-subtle text-muted",
};

const ABAS = [
  { key: "fluxo", label: "Fluxo de caixa" },
  { key: "extrato", label: "Extrato" },
  { key: "conciliacao", label: "Conciliação" },
];

export function CaixaView({ dados, aba }: { dados: Dados; aba: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, revalidar] = useTransition();
  const [modal, setModal] = useState<"movimentacao" | "transferencia" | "importar" | null>(null);
  const [abaAtiva, setAbaAtiva] = useState(aba);
  const [abaProp, setAbaProp] = useState(aba);
  const recarregar = () => revalidar(() => router.refresh());

  if (aba !== abaProp) {
    setAbaProp(aba);
    setAbaAtiva(aba);
  }

  function irPara(patch: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    let needsServer = false;
    for (const [k, v] of Object.entries(patch)) {
      const novo = v === null || v === "" ? null : v;
      if (k !== "aba" && p.get(k) !== novo) {
        needsServer = true;
      }
      if (novo === null) p.delete(k);
      else p.set(k, novo);
    }

    if ("aba" in patch && patch.aba !== null) {
      setAbaAtiva(patch.aba);
    }

    const url = p.toString() ? `?${p.toString()}` : "?";
    if (needsServer) {
      router.push(url);
    } else {
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <div className="space-y-6">
      <Cabecalho onAbrir={setModal} />

      {modal === "movimentacao" && (
        <ModalMovimentacao
          contas={dados.contas} categorias={dados.categorias}
          onFechar={() => setModal(null)}
          onPronto={() => { setModal(null); recarregar(); }}
        />
      )}
      {modal === "transferencia" && (
        <ModalTransferencia
          contas={dados.contas}
          onFechar={() => setModal(null)}
          onPronto={() => { setModal(null); recarregar(); }}
        />
      )}
      {modal === "importar" && (
        <ModalImportar
          contas={dados.contas}
          onFechar={() => setModal(null)}
          onPronto={() => { setModal(null); recarregar(); }}
        />
      )}

      {dados.pendente ? (
        <Aviso titulo="Falta rodar a migração." texto={dados.pendenteMotivo ?? ""} />
      ) : dados.semDados ? (
        <Aviso
          titulo="Sem conexão com o banco"
          texto="A página lê dados reais e não mostra exemplo no lugar deles."
        />
      ) : (
        <>
          <FaixaDeContas dados={dados} irPara={irPara} />

          <div className="flex items-center gap-1 border-b border-line">
            {ABAS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => irPara({ aba: a.key })}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
                  abaAtiva === a.key
                    ? "border-brand-500 font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {a.label}
                {a.key === "conciliacao" && dados.badgeConciliacao > 0 && (
                  <span className="rounded-full bg-amber-500/15 px-2 text-[11px] font-semibold text-amber-600">
                    {dados.badgeConciliacao}
                  </span>
                )}
              </button>
            ))}
            <span className="flex-1" />
            {dados.contaFiltrada && (
              <span className="flex items-center gap-2 pb-2 text-xs text-muted">
                Filtrado: <b className="font-semibold text-ink">{dados.contaFiltrada.nome}</b>
                <button type="button" onClick={() => irPara({ conta: null })}
                  className="font-medium text-brand-600 hover:underline">
                  limpar
                </button>
              </span>
            )}
          </div>

          {abaAtiva === "fluxo" && <AbaFluxo dados={dados} irPara={irPara} />}
          {abaAtiva === "extrato" && <AbaExtrato dados={dados} irPara={irPara} />}
          {abaAtiva === "conciliacao" && <AbaConciliacao dados={dados} onMudou={recarregar} />}
        </>
      )}
    </div>
  );
}

/* ── Cabeçalho (§3) ────────────────────────────────────────────────────── */

function Cabecalho({
  onAbrir,
}: { onAbrir: (m: "movimentacao" | "transferencia" | "importar") => void }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs text-muted">Financeiro</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Caixa</h1>
        <p className="mt-1 text-sm text-muted">
          O dinheiro que se moveu, o que vai se mover e se tudo bate com o banco.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onAbrir("transferencia")}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-brand-300">
          <ArrowLeftRight className="h-4 w-4" />
          Nova transferência
        </button>
        <button type="button" onClick={() => onAbrir("importar")}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink hover:border-brand-300">
          <Upload className="h-4 w-4" />
          Importar extrato
        </button>
        <button type="button" onClick={() => onAbrir("movimentacao")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" />
          Movimentação
        </button>
      </div>
    </header>
  );
}

/* ── Faixa de contas (§4) ──────────────────────────────────────────────── */

function FaixaDeContas({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  return (
    <section aria-label="Contas" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
      <button
        type="button"
        onClick={() => irPara({ conta: null })}
        aria-pressed={!dados.contaFiltrada}
        className={cn(
          "flex flex-col gap-1.5 rounded-2xl border bg-surface p-4 text-left transition-colors",
          !dados.contaFiltrada ? "border-brand-500" : "border-line hover:border-brand-300",
        )}
      >
        <span className="text-xs text-muted">Disponível</span>
        <span className={cn("text-2xl font-semibold tracking-tight",
          dados.disponivelCent < 0 ? "text-rose-600" : "text-ink")}>
          {brlCheio(dados.disponivelCent)}
        </span>
        <span className="text-[11px] text-muted">{dados.folegoTexto}</span>
      </button>

      {dados.contas.map((c) => <CartaoDaConta key={c.id} c={c} dados={dados} irPara={irPara} />)}

      {!dados.contas.length && (
        <Card className="flex items-center justify-center p-4 text-xs text-muted">
          Nenhuma conta financeira cadastrada.
        </Card>
      )}
    </section>
  );
}

function CartaoDaConta({
  c, dados, irPara,
}: { c: CartaoConta; dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const ativa = dados.contaFiltrada?.id === c.id;
  return (
    <button
      type="button"
      onClick={() => irPara({ conta: ativa ? null : c.id })}
      aria-pressed={ativa}
      className={cn(
        "flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-colors",
        // Conta com diferença de saldo tem borda vermelha: ela precisa gritar
        // antes de qualquer outra coisa na faixa.
        c.estado.prioridade === 1 ? "border-rose-500/50"
          : ativa ? "border-brand-500" : "border-line hover:border-brand-300",
        c.noDisponivel ? "bg-surface" : "bg-subtle",
      )}
    >
      <span className="flex items-center gap-1.5 text-xs font-semibold text-ink">
        <span className={cn("h-2 w-2 rounded-sm",
          c.tipo === "gateway" ? "bg-sky-500"
            : c.tipo === "reserva" ? "bg-violet-500"
            : c.tipo === "cartao" ? "bg-amber-500" : "bg-emerald-500")} />
        {c.nome}
      </span>
      <span className={cn("text-lg font-semibold", c.saldoCent < 0 ? "text-rose-600" : "text-ink")}>
        {brlCheio(c.saldoCent)}
      </span>
      <span className={cn("text-[11px] leading-tight", TOM[c.estado.tom])}>{c.estado.texto}</span>
    </button>
  );
}

/* ── Aba Fluxo (§5) ────────────────────────────────────────────────────── */

const HORIZONTES = [
  { key: "30", label: "30 dias" },
  { key: "60", label: "60 dias" },
  { key: "90", label: "90 dias" },
  { key: "365", label: "12 meses" },
];

function AbaFluxo({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const f = dados.fluxo;
  const [recolhidos, setRecolhidos] = useState<string[]>([]);

  if (f.foraDoDisponivel) {
    return (
      <Card className="p-6 text-sm leading-relaxed text-muted">{f.foraDoDisponivel}</Card>
    );
  }

  const linhasVisiveis = f.linhas.filter(
    (l) => l.nivel !== "linha" || !recolhidos.includes(l.bloco ?? ""),
  );

  return (
    <section aria-label="Fluxo de caixa" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted">Próximos</span>
          <div className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1">
            {HORIZONTES.map((h) => (
              <button
                key={h.key}
                type="button"
                onClick={() => irPara({ hz: h.key })}
                aria-pressed={String(f.horizonte) === h.key}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                  String(f.horizonte) === h.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-muted">{f.granularidadeTexto}</span>
        </div>

        {/* Contar como certo o que já não veio é a forma mais fácil de
            projetar um caixa que não existe — por isso a chave nasce desligada. */}
        <button
          type="button"
          role="switch"
          aria-checked={f.incluirVencidos}
          onClick={() => irPara({ vencidos: f.incluirVencidos ? null : "1" })}
          className="flex h-9 items-center gap-2.5 rounded-xl border border-line bg-surface px-3 text-xs text-ink"
        >
          <span className={cn("relative h-4 w-7 rounded-full transition-colors",
            f.incluirVencidos ? "bg-brand-500" : "bg-subtle-strong")}>
            <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
              f.incluirVencidos ? "left-3.5" : "left-0.5")} />
          </span>
          Incluir recebimentos vencidos
        </button>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {f.resumo.map((r) => (
          <Card key={r.key} className="flex flex-col gap-1 p-4">
            <span className="text-[11px] text-muted">{r.label}</span>
            <span className={cn("text-lg font-semibold tracking-tight",
              r.tom === "ruim" ? "text-rose-600" : "text-ink")}>
              {r.valor}
            </span>
            <span className="text-[11px] text-muted">{r.sub}</span>
          </Card>
        ))}
      </div>

      <Grafico dados={dados} />

      <Card className="overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Fluxo por mês</h2>
          <p className="text-xs text-muted">
            Cada bloco responde uma pergunta diferente sobre a mesma variação do caixa.
          </p>
        </div>
        <div className="overflow-x-auto border-t border-line">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-subtle text-[11px] text-muted">
                <th className="sticky left-0 z-10 bg-subtle px-5 py-2.5 text-left font-normal">Linha</th>
                {f.meses.map((m) => (
                  <th key={m.mes} className="px-3 py-2 text-right font-normal">
                    <span className="block font-semibold text-ink">{m.label}</span>
                    <span className="block text-[10px]">{m.tipo}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhasVisiveis.map((l) => (
                <LinhaDaTabelaFluxo
                  key={l.key}
                  l={l}
                  recolhido={recolhidos.includes(l.key)}
                  onAlternar={() =>
                    setRecolhidos((v) => v.includes(l.key) ? v.filter((x) => x !== l.key) : [...v, l.key])}
                />
              ))}
            </tbody>
          </table>
        </div>
        {!f.linhas.length && (
          <p className="px-5 py-10 text-center text-xs text-muted">
            Nenhuma movimentação ou parcela no período.
          </p>
        )}
      </Card>

      <p className="text-[11px] text-muted">{f.nota}</p>
    </section>
  );
}

function Grafico({ dados }: { dados: Dados }) {
  const f = dados.fluxo;
  if (!f.periodos.length) return null;

  const linhaDoSaldo = f.periodos
    .map((p, i) => `${(i / Math.max(1, f.periodos.length - 1)) * 100},${p.saldoY}`)
    .join(" ");
  const realizados = f.periodos.filter((p) => !p.futuro).length;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">
          Saldo, entradas e saídas
        </h2>
        <div className="flex flex-wrap gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 bg-brand-500" />Saldo</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-3.5 border-t border-dashed border-amber-500" />Reserva mínima</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Entradas</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-400" />Saídas</span>
          <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-slate-400" />Previsto</span>
        </div>
      </div>

      {/* Painel do saldo */}
      <div className="relative h-40 rounded-lg bg-subtle">
        {f.reservaY !== null && (
          <span className="absolute inset-x-0 border-t border-dashed border-amber-500"
            style={{ top: `${f.reservaY}%` }} />
        )}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <polyline
            points={linhaDoSaldo}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
            className="text-brand-500"
          />
        </svg>
        {realizados > 0 && realizados < f.periodos.length && (
          <span className="absolute inset-y-0 border-l border-dashed border-line"
            style={{ left: `${(realizados / f.periodos.length) * 100}%` }}>
            <span className="absolute -top-0 left-1 rounded bg-subtle-strong px-1 text-[10px] text-ink">hoje</span>
          </span>
        )}
      </div>

      {/* Painel de entradas e saídas */}
      <div className="flex h-28 items-stretch gap-px">
        {f.periodos.map((p, i) => (
          <div key={`${p.inicio}-${i}`} className="flex flex-1 flex-col"
            title={`${p.label}: entradas ${brlCheio(p.entradasCent)}, saídas ${brlCheio(p.saidasCent)}`}>
            <span className="flex h-1/2 items-end">
              <span
                className={cn("w-full rounded-t-sm",
                  p.futuro ? "border border-b-0 border-emerald-500" : "bg-emerald-500")}
                style={{ height: `${p.alturaEntradas}%` }}
              />
            </span>
            <span className="flex h-1/2 items-start border-t border-line">
              <span
                className={cn("w-full rounded-b-sm",
                  p.futuro ? "border border-t-0 border-slate-400" : "bg-slate-400")}
                style={{ height: `${p.alturaSaidas}%` }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-[10px] text-muted">
        {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
          const p = f.periodos[Math.min(f.periodos.length - 1, Math.round(frac * (f.periodos.length - 1)))];
          return <span key={frac}>{p?.label}</span>;
        })}
      </div>

      {f.menorSaldo && (
        <p className={cn("text-xs",
          f.menorSaldo.abaixoDaReserva || f.menorSaldo.valorCent < 0 ? "text-rose-600" : "text-muted")}>
          Menor saldo do horizonte: {brlCheio(f.menorSaldo.valorCent)} em{" "}
          {f.menorSaldo.dataIso.slice(8, 10)}/{f.menorSaldo.dataIso.slice(5, 7)}
          {f.menorSaldo.abaixoDaReserva && ", abaixo da reserva mínima"}.
        </p>
      )}
    </Card>
  );
}

function LinhaDaTabelaFluxo({
  l, recolhido, onAlternar,
}: { l: LinhaDaTabela; recolhido: boolean; onAlternar: () => void }) {
  const bloco = l.nivel === "bloco";
  const saldo = l.nivel === "saldo";

  return (
    <tr className={cn("border-b border-line", (bloco || saldo) && "bg-subtle")}>
      <th
        scope="row"
        className={cn(
          "sticky left-0 z-10 px-5 py-2.5 text-left font-normal",
          bloco || saldo ? "bg-subtle text-ink" : "bg-surface pl-9 text-muted",
          bloco && "text-[11px] font-bold uppercase tracking-wide",
          saldo && "font-semibold",
        )}
      >
        {bloco ? (
          <button type="button" onClick={onAlternar} className="flex items-center gap-1.5">
            <span className={cn("transition-transform", !recolhido && "rotate-90")}>›</span>
            {l.label}
          </button>
        ) : l.label}
      </th>
      {l.celulas.map((c) => (
        <td key={c.mes} className={cn("px-3 py-2.5 text-right tabular-nums",
          bloco || saldo ? "font-semibold text-ink" : c.valorCent > 0 ? "text-emerald-600" : "text-ink")}>
          {c.valorCent === 0 ? "—" : brlCheio(c.valorCent).replace("R$ ", "")}
        </td>
      ))}
    </tr>
  );
}

/* ── Aba Extrato (§6) ──────────────────────────────────────────────────── */

function AbaExtrato({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const params = useSearchParams();
  const [busca, setBusca] = useState(params.get("q") ?? "");
  const e = dados.extrato;

  return (
    <section aria-label="Extrato" className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={(ev) => { ev.preventDefault(); irPara({ q: busca || null }); }}
          className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="search" value={busca} onChange={(ev) => setBusca(ev.target.value)}
            placeholder="Descrição, valor ou contraparte"
            className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </form>
        <div className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1">
          {[["todas", "Todas"], ["entradas", "Entradas"], ["saidas", "Saídas"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => irPara({ tipo: k === "todas" ? null : k })}
              aria-pressed={(params.get("tipo") ?? "todas") === k}
              className={cn("h-7 rounded-lg px-2.5 text-xs font-medium transition-colors",
                (params.get("tipo") ?? "todas") === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink")}>
              {l}
            </button>
          ))}
        </div>
        <select
          value={params.get("status") ?? "todos"}
          onChange={(ev) => irPara({ status: ev.target.value === "todos" ? null : ev.target.value })}
          className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400"
        >
          <option value="todos">Todos os status</option>
          <option value="conciliada">Conciliadas</option>
          <option value="pendente">Pendentes</option>
          <option value="ignorada">Ignoradas</option>
        </select>
      </div>

      {!e.comSaldoCorrido && (
        <p className="text-xs text-muted">
          Escolha uma conta na faixa acima para ver o saldo corrido e os pontos de conferência.
        </p>
      )}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[70px_minmax(0,1fr)_100px_200px_110px_110px_110px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>Data</span><span>Descrição</span><span>Conta</span><span>Vínculo</span>
          <span className="text-right">Entrada</span><span className="text-right">Saída</span>
          <span className="text-right">{e.comSaldoCorrido ? "Saldo" : ""}</span>
        </div>

        {e.dias.map((d) => (
          <div key={d.dataIso}>
            <div className="flex justify-between border-b border-line bg-subtle px-5 py-2 text-[11px]">
              <span className="font-semibold text-ink">{d.label}</span>
              {d.saldoFimCent !== null && (
                <span className="text-muted">Saldo no fim do dia {brlCheio(d.saldoFimCent)}</span>
              )}
            </div>
            {d.conferencia && (
              <p className={cn("border-b border-line px-5 py-2 text-xs",
                d.conferencia.confere ? "bg-emerald-500/5 text-emerald-600" : "bg-rose-500/5 text-rose-600")}>
                {d.conferencia.texto}
              </p>
            )}
            <ul className="m-0 list-none p-0">
              {d.linhas.map((l) => (
                <li key={l.id}
                  className={cn(
                    "grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[70px_minmax(0,1fr)_100px_200px_110px_110px_110px]",
                    l.status === "ignorada" && "opacity-50",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-[11px] text-muted">
                    <span className={cn("h-2 w-2 rounded-full",
                      l.status === "conciliada" ? "bg-emerald-500"
                        : l.status === "pendente" ? "bg-amber-500" : "bg-subtle-strong")} />
                    {l.dataLabel}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("truncate text-sm text-ink",
                      l.status === "ignorada" && "line-through")}>
                      {l.descricaoClean}
                    </span>
                    <span className="truncate font-mono text-[10px] text-muted">{l.descricaoRaw}</span>
                  </span>
                  <span className="truncate text-xs text-muted">{l.conta}</span>
                  <span className={cn("truncate text-xs", TOM[l.vinculoTom])}>{l.vinculo}</span>
                  <span className="text-right text-sm font-semibold text-emerald-600">
                    {l.entradaCent ? brlCheio(l.entradaCent) : ""}
                  </span>
                  <span className="text-right text-sm font-semibold text-ink">
                    {l.saidaCent ? brlCheio(l.saidaCent) : ""}
                  </span>
                  <span className="text-right text-xs text-muted">
                    {l.saldoCent !== null ? brlCheio(l.saldoCent) : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        {!e.total && (
          <p className="px-5 py-10 text-center text-xs text-muted">
            Nenhuma movimentação neste filtro.
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-5 py-3 text-xs text-muted">
          <span>{e.total} {e.total === 1 ? "movimentação" : "movimentações"}</span>
          <span className="flex gap-5">
            <span>Entradas <b className="text-emerald-600">{brlCheio(e.entradasCent)}</b></span>
            <span>Saídas <b className="text-ink">{brlCheio(e.saidasCent)}</b></span>
          </span>
        </div>
      </Card>
    </section>
  );
}

/* ── Aba Conciliação (§8) ──────────────────────────────────────────────── */

function AbaConciliacao({ dados, onMudou }: { dados: Dados; onMudou: () => void }) {
  const c = dados.conciliacao;
  const aindaNao = (o: string) => toast(`${o} sai desta página em breve.`, "error");

  return (
    <section aria-label="Conciliação" className="space-y-4">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-[11px] text-muted">Pendentes</span>
          <span className="text-xl font-semibold text-ink">{c.pendentes}</span>
          <span className="text-[11px] text-muted">{c.pendentesSub}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-[11px] text-muted">Mais antiga</span>
          <span className={cn("text-xl font-semibold",
            c.maisAntigaDias !== null && c.maisAntigaDias > 7 ? "text-amber-600" : "text-ink")}>
            {c.maisAntigaDias === null ? "—" : `há ${c.maisAntigaDias} dias`}
          </span>
          <span className="truncate text-[11px] text-muted">{c.maisAntigaSub}</span>
        </Card>
        <Card className="flex flex-col gap-1 p-4">
          <span className="text-[11px] text-muted">Conciliadas automaticamente, 7 dias</span>
          <span className="text-xl font-semibold text-ink">{c.automaticas7}</span>
          <span className="text-[11px] text-muted">Asaas e regras aprendidas</span>
        </Card>
        <Card className={cn("flex flex-col gap-1 p-4", !c.fechamento.liberado && "border-amber-500/40")}>
          <span className="text-[11px] text-muted">Fechamento de {c.fechamento.mesLabel}</span>
          <span className={cn("text-xl font-semibold",
            c.fechamento.liberado ? "text-emerald-600" : "text-amber-600")}>
            {c.fechamento.liberado ? "Liberado" : `${c.fechamento.total} pendências`}
          </span>
          <span className="text-[11px] text-muted">{c.fechamento.texto}</span>
        </Card>
      </div>

      {c.exatas > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => aindaNao("A conciliação em lote")}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            <Check className="h-4 w-4" />
            Conciliar as {c.exatas} correspondências exatas
          </button>
        </div>
      )}

      {c.fila.length ? (
        <div className="space-y-2.5">
          {c.fila.map((it) => (
            <CartaoDaFila key={it.id} it={it} dados={dados} onMudou={onMudou} />
          ))}
        </div>
      ) : (
        <Card className="flex items-center gap-4 p-8">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600">
            <Check className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink">Tudo conciliado neste filtro</span>
            <span className="block text-xs text-muted">
              {c.semExtrato
                ? "Nenhuma conta usa importação de extrato: o realizado vem das baixas manuais."
                : "Nenhuma movimentação pendente de explicação."}
            </span>
          </span>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Baixas sem confirmação no extrato</h2>
          <p className="text-xs text-muted">
            Registradas manualmente e ainda não vistas no banco.
          </p>
        </div>
        {c.baixasSemConfirmacao.length ? (
          c.baixasSemConfirmacao.map((b) => (
            <div key={b.id} className="grid items-center gap-3 border-t border-line px-5 py-3 lg:grid-cols-[minmax(0,1fr)_110px_120px_auto]">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm text-ink">{b.descricao}</span>
                <span className="truncate text-[11px] text-muted">{b.sub}</span>
              </span>
              <span className="text-xs text-amber-600">há {b.dias} dias</span>
              <span className="text-right text-sm font-semibold text-ink">{brlCheio(b.valorCent)}</span>
              <span className="flex gap-1.5">
                {["Procurar no extrato", "Confirmar sem extrato", "Estornar"].map((a) => (
                  <button key={a} type="button" onClick={() => aindaNao(a)}
                    className="h-8 rounded-lg border border-line bg-surface px-2.5 text-[11px] text-ink hover:border-brand-300">
                    {a}
                  </button>
                ))}
              </span>
            </div>
          ))
        ) : (
          <p className="border-t border-line px-5 py-4 text-xs text-muted">
            Nenhuma baixa aguardando confirmação.
          </p>
        )}
      </Card>
    </section>
  );
}

function CartaoDaFila({
  it, dados, onMudou,
}: { it: ItemDaFila; dados: Dados; onMudou: () => void }) {
  return (
    <Card className={cn("overflow-hidden", it.exata && "border-emerald-500/40")}>
      <div className="grid lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-1.5 border-r border-line bg-subtle p-4">
          <p className="flex justify-between text-[11px] text-muted">
            <span>{it.dataLabel}, {it.conta}</span>
            <span>{it.idade}</span>
          </p>
          <p className={cn("text-lg font-semibold",
            it.valorCent > 0 ? "text-emerald-600" : "text-ink")}>
            {brlCheio(it.valorCent)}
          </p>
          <p className="break-all font-mono text-[10px] text-muted">{it.descricaoRaw}</p>
        </div>

        <div className="space-y-2 p-4">
          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
            TOM_CHIP[it.seloTom])}>
            {it.selo}
          </span>
          <p className="text-sm font-semibold text-ink">{it.titulo}</p>
          <p className="text-xs text-muted">{it.detalhe}</p>
          <AcoesDaFila item={it} categorias={dados.categorias} onPronto={onMudou} />
        </div>
      </div>
    </Card>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────── */

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Card className="flex flex-col gap-1 p-5">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <p className="text-xs text-muted">{texto}</p>
    </Card>
  );
}
