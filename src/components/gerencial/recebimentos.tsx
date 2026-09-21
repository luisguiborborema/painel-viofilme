"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ChevronDown, ChevronLeft, ChevronRight, MessageCircle, Plus, Repeat, Search,
  TriangleAlert, Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio } from "@/lib/data/dashboard-financeiro";
import type {
  ClienteFinanceiro, ClienteInadimplente, ContaAReceber, RecebimentosView as Dados,
  RecorrenciaReceita,
} from "@/lib/data/recebimentos-server";

/**
 * Recebimentos (spec da página 2) — o lugar de todo dinheiro que precisa entrar.
 *
 * As quatro abas respondem perguntas diferentes: o que tenho a receber e o que
 * fazer (Contas), quais contratos geram receita todo mês (Recorrências), quem
 * está devendo e o que estamos fazendo (Inadimplência) e como cada cliente se
 * comporta (Clientes).
 *
 * A tela não calcula nada: chip, valor atualizado, etapa da régua e perfil
 * pagador chegam prontos da camada de leitura.
 */

const TOM_CHIP: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  ruim: "bg-rose-500/15 text-rose-600",
  atencao: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  roxo: "bg-violet-500/15 text-violet-600",
  neutro: "bg-subtle text-muted",
};

const TOM_TEXTO: Record<string, string> = {
  ok: "text-emerald-600",
  ruim: "text-rose-600",
  atencao: "text-amber-600",
  info: "text-sky-600",
  neutro: "text-muted",
};

const ABAS = [
  { key: "contas", label: "Contas a receber" },
  { key: "recorrencias", label: "Recorrências" },
  { key: "inadimplencia", label: "Inadimplência" },
  { key: "clientes", label: "Clientes" },
];

export function RecebimentosView({ dados, aba }: { dados: Dados; aba: string }) {
  const router = useRouter();
  const params = useSearchParams();

  /** Um só caminho para mexer na URL: filtro é estado compartilhável. */
  function irPara(patch: Record<string, string | null>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") p.delete(k);
      else p.set(k, v);
    }
    router.push(`?${p.toString()}`);
  }

  return (
    <div className="space-y-6">
      <Cabecalho />

      {dados.pendente ? (
        <Aviso
          titulo="Falta rodar a migração."
          texto="Recebimentos lê o núcleo transacional (0149) e a régua de cobrança (0150). Rode as duas no Supabase e recarregue."
        />
      ) : dados.semDados ? (
        <Aviso
          titulo="Sem conexão com o banco"
          texto="A página lê dados reais e não mostra exemplo no lugar deles."
        />
      ) : (
        <>
          <Indicadores dados={dados} irPara={irPara} />

          <div className="flex gap-1 border-b border-line">
            {ABAS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => irPara({ aba: a.key, faixa: null })}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
                  aba === a.key
                    ? "border-brand-500 font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {a.label}
                {a.key === "inadimplencia" && dados.badgeInadimplencia > 0 && (
                  <span className="rounded-full bg-rose-500/15 px-2 text-[11px] font-semibold text-rose-600">
                    {dados.badgeInadimplencia}
                  </span>
                )}
              </button>
            ))}
          </div>

          {aba === "contas" && <AbaContas dados={dados} irPara={irPara} />}
          {aba === "recorrencias" && <AbaRecorrencias dados={dados} />}
          {aba === "inadimplencia" && <AbaInadimplencia dados={dados} irPara={irPara} />}
          {aba === "clientes" && <AbaClientes dados={dados} irPara={irPara} />}
        </>
      )}
    </div>
  );
}

/* ── Cabeçalho (§2) ────────────────────────────────────────────────────── */

function Cabecalho() {
  const aindaNao = (o: string) =>
    toast(`${o} ainda não existe nesta página: por enquanto, use o Financeiro antigo.`, "error");
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs text-muted">Financeiro</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Recebimentos</h1>
        <p className="mt-1 text-sm text-muted">
          Tudo o que precisa entrar: contas, recorrências, atrasos e clientes.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => aindaNao("A importação por CSV")}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand-300"
        >
          <Upload className="h-4 w-4" />
          Importar CSV
        </button>
        <button
          type="button"
          onClick={() => aindaNao("O cadastro de nova receita")}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Nova receita
        </button>
      </div>
    </header>
  );
}

/* ── Faixa de indicadores (§3) ─────────────────────────────────────────── */

function Indicadores({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const i = dados.indicadores;
  const cartao =
    "flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition-colors hover:border-brand-300";
  const mes = dados.mesLabel.split(" de ")[0];

  return (
    <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button type="button" className={cartao} onClick={() => irPara({ aba: "contas", visao: "aberto" })}>
        <span className="text-xs text-muted">A vencer em {mes}</span>
        <span className="text-2xl font-semibold tracking-tight text-ink">{brlCheio(i.aVencerCent)}</span>
        <span className="text-xs text-muted">{i.aVencerContexto}</span>
      </button>

      <button type="button" className={cartao} onClick={() => irPara({ aba: "contas", visao: "recebidas" })}>
        <span className="text-xs text-muted">Recebido em {mes}</span>
        <span className="text-2xl font-semibold tracking-tight text-ink">{brlCheio(i.recebidoCent)}</span>
        <span className="flex h-1.5 overflow-hidden rounded-full bg-subtle-strong">
          <span className="bg-emerald-500" style={{ width: `${Math.min(100, i.recebidoPct)}%` }} />
        </span>
        <span className="text-xs text-muted">{i.recebidoContexto}</span>
      </button>

      <button type="button" className={cartao} onClick={() => irPara({ aba: "inadimplencia" })}>
        <span className="text-xs text-muted">Vencido</span>
        <span className={cn("text-2xl font-semibold tracking-tight", i.vencidoCent > 0 ? "text-rose-600" : "text-ink")}>
          {brlCheio(i.vencidoCent)}
        </span>
        <span className="text-xs text-muted">{i.vencidoContexto}</span>
      </button>

      <button type="button" className={cartao} onClick={() => irPara({ aba: "inadimplencia" })}>
        <span className="text-xs text-muted">Inadimplência 90 dias</span>
        {/* Sem vencimento no período não existe percentual — e 0% diria que
            está tudo em dia, que é coisa diferente de não ter vencido nada. */}
        <span className="text-2xl font-semibold tracking-tight text-ink">
          {i.inadimplencia90Pct === null ? "—" : `${pct(i.inadimplencia90Pct)}%`}
        </span>
        <span className="text-xs text-muted">{i.inadimplenciaContexto}</span>
      </button>
    </section>
  );
}

/* ── Aba Contas a receber (§4) ─────────────────────────────────────────── */

function AbaContas({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const params = useSearchParams();
  const visao = params.get("visao") ?? "aberto";
  const chip = params.get("chip");
  const [busca, setBusca] = useState(params.get("q") ?? "");

  function mudarMes(delta: number) {
    const [a, m] = dados.mesIso.split("-").map(Number);
    const d = new Date(Date.UTC(a, m - 1 + delta, 1));
    irPara({ mes: d.toISOString().slice(0, 7) });
  }

  return (
    <section aria-label="Contas a receber" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1">
          {dados.visoes.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => irPara({ visao: v.key })}
              aria-pressed={visao === v.key}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors",
                visao === v.key ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              {v.label}
              <span className={cn(
                "text-[11px]",
                v.key === "vencidas" && visao !== "vencidas" && v.total > 0 ? "text-rose-600" : "text-muted",
              )}>
                {v.total}
              </span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted hover:text-ink">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[132px] text-center text-sm font-semibold text-ink">{dados.mesLabel}</span>
            <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted hover:text-ink">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          {/* Vencimento é quando o dinheiro entra; competência é o mês a que a
              receita pertence. Trocar a base muda o que o mês significa. */}
          <div className="flex gap-0.5 rounded-xl border border-line bg-subtle p-1">
            {[["vencimento", "Vencimento"], ["competencia", "Competência"]].map(([k, l]) => (
              <button
                key={k}
                type="button"
                onClick={() => irPara({ base: k })}
                aria-pressed={dados.base === k}
                className={cn(
                  "h-8 rounded-lg px-3 text-xs font-medium transition-colors",
                  dados.base === k ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); irPara({ q: busca || null }); }}
          className="relative w-72"
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente, descrição, NF ou valor"
            className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </form>
        {/* O chip é o destino da exceção E5 do Dashboard: liga o filtro e
            volta para Em aberto, porque é lá que a cobrança falta. */}
        <button
          type="button"
          onClick={() => irPara({ chip: chip === "sem-cobranca" ? null : "sem-cobranca", visao: "aberto" })}
          aria-pressed={chip === "sem-cobranca"}
          className={cn(
            "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
            chip === "sem-cobranca"
              ? "border-brand-500 bg-brand-500 text-white"
              : "border-line bg-surface text-muted hover:text-ink",
          )}
        >
          Sem cobrança
          <span className={cn("text-[11px]", chip === "sem-cobranca" ? "text-white/70" : "text-muted")}>
            {dados.semCobranca}
          </span>
        </button>
      </div>

      {dados.semClienteVinculado > 0 && (
        <Aviso
          tom="atencao"
          titulo={`${dados.semClienteVinculado} ${dados.semClienteVinculado === 1
            ? "parcela não tem cliente vinculado" : "parcelas não têm cliente vinculado"}.`}
          texto="Vieram do Asaas ou de lançamento manual sem cliente. Sem o vínculo, elas não entram no perfil pagador nem na régua de cobrança do cliente."
        />
      )}

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[92px_minmax(0,1.1fr)_minmax(0,1.4fr)_190px_150px_120px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>Vencimento</span><span>Cliente</span><span>Descrição</span>
          <span>Situação</span><span className="text-right">Valor</span><span />
        </div>

        <ul className="m-0 list-none p-0">
          {dados.contas.map((c) => <LinhaConta key={c.id} c={c} />)}
        </ul>

        {!dados.totalNoFiltro && (
          <div className="flex flex-col items-center gap-1.5 px-5 py-11 text-center">
            <p className="text-sm font-medium text-ink">Nada por aqui neste filtro</p>
            {/* O atraso não pertence ao mês navegado (§18): sem esta frase, a
                tela vazia esconde as vencidas que a aba ao lado conta. */}
            <p className="text-xs text-muted">
              {visao === "aberto" && dados.vencidasForaDoMes > 0
                ? `${dados.vencidasForaDoMes} ${dados.vencidasForaDoMes === 1
                    ? "parcela vencida de outro mês aparece" : "parcelas vencidas de outros meses aparecem"} na visão Vencidas.`
                : "Troque a visão, o mês ou limpe a busca."}
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-5 py-3 text-xs text-muted">
          <span>{dados.totalNoFiltro} {dados.totalNoFiltro === 1 ? "parcela" : "parcelas"} neste filtro</span>
          <span className="flex flex-wrap gap-5">
            <span>Total <b className="text-ink">{brlCheio(dados.rodape.totalCent)}</b></span>
            <span>Em aberto <b className="text-ink">{brlCheio(dados.rodape.abertoCent)}</b></span>
            <span>Recebido <b className="text-emerald-600">{brlCheio(dados.rodape.recebidoCent)}</b></span>
            <span>Vencido <b className="text-rose-600">{brlCheio(dados.rodape.vencidoCent)}</b></span>
          </span>
        </div>
      </Card>
    </section>
  );
}

function LinhaConta({ c }: { c: ContaAReceber }) {
  const aindaNao = () =>
    toast(
      c.acao === "enviar_cobranca"
        ? "A emissão de cobrança no Asaas sai desta página em breve: por enquanto, emita no Financeiro antigo."
        : c.acao === "registrar"
          ? "O registro de recebimento sai desta página em breve."
          : "O comprovante ainda não está anexado a esta baixa.",
      "error",
    );

  return (
    <li
      className="grid items-center gap-3 border-b border-line px-5 py-3 transition-colors hover:bg-subtle lg:grid-cols-[92px_minmax(0,1.1fr)_minmax(0,1.4fr)_190px_150px_120px] lg:py-0"
      style={{ minHeight: 66 }}
    >
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{c.vencimentoLabel}</span>
        <span className={cn("text-[11px]", TOM_TEXTO[c.relativoTom])}>{c.relativo}</span>
      </span>

      <span className="flex min-w-0 flex-col">
        <span className={cn("truncate text-sm font-semibold", c.partyId || c.clienteId ? "text-ink" : "text-muted")}>
          {c.cliente}
        </span>
        <span className="truncate text-[11px] text-muted">{c.origem}</span>
      </span>

      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm text-ink">{c.descricao}</span>
          {c.recorrente && <Repeat className="h-3 w-3 shrink-0 text-muted" aria-label="Recorrência" />}
          {c.parcelaLabel && (
            <span className="shrink-0 rounded bg-subtle-strong px-1.5 text-[10px] font-semibold text-muted">
              {c.parcelaLabel}
            </span>
          )}
        </span>
        <span className="truncate text-[11px] text-muted">
          {[c.competenciaLabel, ...c.servicos].join(" · ")}
        </span>
      </span>

      <span className="flex flex-col items-start gap-1">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM_CHIP[c.situacaoTom])}>
          {c.situacaoLabel}
        </span>
        {/* A situação da cobrança é outro eixo: dá para vencer em 3 dias com a
            cobrança nem emitida, e é isso que decide o que fazer hoje. */}
        <span className={cn("flex items-center gap-1.5 text-[11px]", TOM_TEXTO[c.cobranca.tom])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {c.cobranca.texto}
        </span>
      </span>

      <span className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-semibold text-ink">
          {brlCheio(c.recebida ? c.valorCent : c.saldoCent)}
        </span>
        {c.subValor && (
          <span className={cn("text-[11px]", TOM_TEXTO[c.subValorTom])}>{c.subValor}</span>
        )}
      </span>

      <span className="flex justify-end">
        <button
          type="button"
          onClick={aindaNao}
          className="h-8 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink transition-colors hover:border-brand-300"
        >
          {c.acaoLabel}
        </button>
      </span>
    </li>
  );
}

/* ── Aba Recorrências (§8) ─────────────────────────────────────────────── */

function AbaRecorrencias({ dados }: { dados: Dados }) {
  const r = dados.recorrenciasResumo;
  return (
    <section aria-label="Recorrências" className="space-y-4">
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <Numero titulo="MRR" valor={brlCheio(r.mrrCent)} />
        <Numero titulo="Ativas" valor={String(r.ativas)} />
        <Numero titulo="Pausadas" valor={String(r.pausadas)} />
        <Numero titulo="Reajustes em 30 dias" valor={String(r.reajustes30)}
          tom={r.reajustes30 > 0 ? "atencao" : "neutro"} />
        <Numero titulo="Encerrando em 60 dias" valor={String(r.encerrando60)} />
      </Card>

      {!dados.recorrencias.length ? (
        <Card className="flex flex-col items-center gap-2 px-5 py-11 text-center">
          <p className="text-sm font-medium text-ink">Nenhuma recorrência no Financeiro</p>
          {/* O contraste é o dado útil: o contrato existe no cadastro
              comercial, mas nada gera parcela — por isso o MRR daqui é zero. */}
          <p className="max-w-lg text-xs text-muted">
            {r.clientesComFee > 0
              ? `${r.clientesComFee} ${r.clientesComFee === 1 ? "cliente tem" : "clientes têm"} fee mensal no cadastro, somando ${brlCheio(r.feeContratadoCent)} por mês, mas nenhuma recorrência financeira foi criada. Sem ela, nenhuma parcela é gerada e o MRR desta página fica em zero.`
              : "Recorrência é a regra que gera as parcelas todo mês. Nenhuma foi cadastrada ainda."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_130px_110px_130px_120px_100px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
            <span>Cliente</span><span>Serviços</span><span className="text-right">Valor mensal</span>
            <span>Vencimento</span><span>Próxima cobrança</span><span>Reajuste</span><span>Status</span>
          </div>
          <ul className="m-0 list-none p-0">
            {dados.recorrencias.map((r) => <LinhaRecorrencia key={r.id} r={r} />)}
          </ul>
        </Card>
      )}
    </section>
  );
}

function LinhaRecorrencia({ r }: { r: RecorrenciaReceita }) {
  return (
    <li className="grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_130px_110px_130px_120px_100px]">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-semibold text-ink">{r.cliente}</span>
        <span className="truncate text-[11px] text-muted">{r.vigencia || r.descricao}</span>
      </span>
      <span className="flex flex-wrap gap-1">
        {r.servicos.length
          ? r.servicos.map((s) => (
              <span key={s} className="rounded bg-subtle-strong px-1.5 py-0.5 text-[10px] text-muted">{s}</span>
            ))
          : <span className="text-[11px] text-muted">—</span>}
      </span>
      <span className="text-right text-sm font-semibold text-ink">{brlCheio(r.valorCent)}</span>
      <span className="text-xs text-muted">Todo dia {r.dia}</span>
      <span className="text-xs text-muted">{r.proxima}</span>
      <span className="text-xs text-muted">{r.reajuste}</span>
      <span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM_CHIP[r.statusTom])}>
          {r.statusLabel}
        </span>
      </span>
    </li>
  );
}

/* ── Aba Inadimplência (§9) ────────────────────────────────────────────── */

function AbaInadimplencia({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const params = useSearchParams();
  const faixa = params.get("faixa");
  const [aberta, setAberta] = useState<string | null>(null);
  const i = dados.inadimplencia;

  return (
    <section aria-label="Inadimplência" className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="space-y-4 p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-ink">Vencidos por tempo de atraso</h2>
            {faixa && (
              <button type="button" onClick={() => irPara({ faixa: null })}
                className="text-xs font-medium text-brand-600 hover:underline">
                Limpar filtro
              </button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-2">
            {dados.aging.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => irPara({ faixa: faixa === f.key ? null : f.key })}
                aria-pressed={faixa === f.key}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border p-3 text-left transition-colors",
                  faixa === f.key ? "border-brand-500 bg-brand-500/5" : "border-line hover:border-brand-300",
                )}
              >
                <span className="text-xs font-semibold text-ink">
                  {f.valorCent > 0 ? brlCheio(f.valorCent) : "—"}
                </span>
                <span className="flex h-12 items-end">
                  <span className="w-full rounded-t bg-rose-500/70"
                    style={{ height: `${Math.max(f.alturaPct, f.valorCent > 0 ? 8 : 0)}%` }} />
                </span>
                <span className="text-[11px] text-muted">{f.label}</span>
                <span className="text-[11px] text-muted">{quemDeve(dados, f.key)}</span>
              </button>
            ))}
          </div>
        </Card>

        <Card className="grid grid-cols-2 gap-4 p-5">
          <Numero titulo="Total vencido" valor={brlCheio(i.totalCent)} nota={i.contexto}
            tom={i.totalCent > 0 ? "ruim" : "neutro"} />
          <Numero titulo="Inadimplência 90 dias" valor={i.pct === null ? "—" : `${pct(i.pct)}%`}
            nota={`Meta até ${i.metaPct}%`} tom={i.pct !== null && i.pct > i.metaPct ? "ruim" : "neutro"} />
          <Numero titulo="Atraso médio"
            valor={i.atrasoMedioDias === null ? "—" : `${i.atrasoMedioDias.toFixed(1).replace(".", ",")} dias`}
            nota={i.atrasoMedioDias === null ? "nenhum recebimento medido" : "sobre os recebimentos registrados"} />
          <Numero titulo="Promessas ativas" valor={String(i.promessasAtivas)}
            nota="Régua pausada até a data" />
        </Card>
      </div>

      <Card className="space-y-3 p-5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Régua de cobrança</h2>
          <span className="text-xs text-muted">Padrão</span>
        </div>
        {/* Dizer que a etapa é "automática" sem job rodando seria prometer um
            e-mail que ninguém envia. A faixa mostra a posição, não o envio. */}
        {!dados.reguaAtiva && (
          <p className="text-xs text-amber-600">
            As etapas automáticas ainda não disparam: não existe job de cobrança rodando. A faixa mostra
            em que etapa cada cliente estaria hoje, e o envio é manual.
          </p>
        )}
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {dados.regua.map((e) => (
            <div
              key={e.dia}
              className={cn(
                "flex flex-col gap-1 rounded-xl border p-3",
                e.clientes > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-line",
              )}
            >
              <span className="text-xs font-semibold text-ink">{e.dia}</span>
              <span className="text-[11px] text-muted">{e.acao}</span>
              <span className="text-[11px] text-muted">{e.modoLabel}{e.canal ? ` · ${e.canal}` : ""}</span>
              <span className={cn("text-[11px] font-semibold", e.clientes > 0 ? "text-amber-600" : "text-muted")}>
                {e.clientes} nesta etapa
              </span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.2fr)_140px_90px_minmax(0,1.4fr)_minmax(0,1fr)_130px_24px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>Cliente</span><span className="text-right">Vencido</span><span>Atraso</span>
          <span>Etapa e próximo passo</span><span>Último contato</span><span>Perfil</span><span />
        </div>
        <ul className="m-0 list-none p-0">
          {dados.inadimplentes.map((c) => (
            <LinhaInadimplente
              key={c.key}
              c={c}
              aberta={aberta === c.key}
              onToggle={() => setAberta(aberta === c.key ? null : c.key)}
            />
          ))}
        </ul>
        {!dados.inadimplentes.length && (
          <div className="flex flex-col items-center gap-1.5 px-5 py-11 text-center">
            <p className="text-sm font-medium text-ink">
              {faixa ? "Nenhum cliente nesta faixa de atraso" : "Ninguém em atraso"}
            </p>
            <p className="text-xs text-muted">
              {faixa ? "Limpe o filtro para ver as outras faixas." : "Nenhuma parcela de entrada venceu sem receber."}
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}

function LinhaInadimplente({
  c, aberta, onToggle,
}: { c: ClienteInadimplente; aberta: boolean; onToggle: () => void }) {
  const aindaNao = (o: string) => toast(`${o} sai desta página em breve.`, "error");

  return (
    <li className="border-b border-line">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={aberta}
        className="grid w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-subtle lg:grid-cols-[minmax(0,1.2fr)_140px_90px_minmax(0,1.4fr)_minmax(0,1fr)_130px_24px]"
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-ink">{c.nome}</span>
          <span className="truncate text-[11px] text-muted">
            {c.cs ? `CS: ${c.cs}` : "sem responsável definido"}
          </span>
        </span>
        <span className="flex flex-col items-end">
          <span className="text-sm font-semibold text-rose-600">{brlCheio(c.vencidoCent)}</span>
          <span className="text-[11px] text-muted">
            {c.parcelas.length} {c.parcelas.length === 1 ? "parcela" : "parcelas"}
          </span>
        </span>
        <span className="text-sm text-ink">{c.diasAtraso} d</span>
        <span className="flex min-w-0 flex-col">
          <span className={cn("truncate text-xs font-medium", TOM_TEXTO[c.etapaTom])}>{c.etapaLabel}</span>
          <span className="truncate text-[11px] text-muted">{c.proximoPasso}</span>
        </span>
        <span className="truncate text-[11px] text-muted">{c.ultimoContato}</span>
        <span>
          <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM_CHIP[c.perfilTom])}>
            {c.perfilLabel}
          </span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", aberta && "rotate-180")} />
      </button>

      {aberta && (
        <div className="grid gap-5 border-t border-line bg-subtle px-5 py-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Parcelas vencidas</p>
              {c.parcelas.map((p) => (
                <div key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-line bg-surface px-3 py-2">
                  <span className="text-sm text-ink">{p.descricao}</span>
                  <span className="text-[11px] text-muted">Venceu {p.vencimentoLabel}</span>
                  <span className="text-sm font-semibold text-ink">{brlCheio(p.saldoCent)}</span>
                  {p.atualizadoLabel && (
                    <span className="text-[11px] text-amber-600">{p.atualizadoLabel}</span>
                  )}
                </div>
              ))}
            </div>

            {c.pendenciaManual && (
              <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-xs font-semibold text-amber-600">
                  Pendente: {c.pendenciaManual.acao} (etapa {c.pendenciaManual.etapa})
                </p>
                <p className="text-[11px] text-muted">Envio manual até a integração existir.</p>
                {c.pendenciaManual.mensagem && (
                  <p className="rounded-lg bg-surface p-2 text-xs text-ink">{c.pendenciaManual.mensagem}</p>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  {c.pendenciaManual.whatsapp && (
                    <a
                      href={c.pendenciaManual.whatsapp}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:border-brand-300"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Abrir no WhatsApp
                    </a>
                  )}
                  {c.pendenciaManual.aviso && (
                    <span className="text-[11px] text-amber-600">{c.pendenciaManual.aviso}</span>
                  )}
                  {c.pendenciaManual.mensagem && (
                    <button type="button" onClick={() => aindaNao("Marcar como enviado")}
                      className="h-8 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:border-brand-300">
                      Marcar como enviado
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                Linha do tempo da cobrança
              </p>
              {c.eventos.length ? (
                <ol className="m-0 list-none space-y-1.5 p-0">
                  {c.eventos.map((e) => (
                    <li key={e.id} className="flex items-center gap-2 text-xs">
                      <span className={cn("h-1.5 w-1.5 rounded-full bg-current", TOM_TEXTO[e.tom])} />
                      <span className="text-muted">{e.dataLabel}</span>
                      <span className="text-ink">{e.texto}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-muted">
                  Nenhum contato registrado. Todo envio, promessa ou conversa registrada aparece aqui.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ações</p>
            {[
              "Enviar lembrete agora", "Registrar contato", "Registrar promessa de pagamento",
              "Renegociar", "Pausar régua", "Acionar CS", "Registrar como perda",
            ].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => aindaNao(a)}
                className="h-9 rounded-lg border border-line bg-surface px-3 text-left text-xs font-medium text-ink transition-colors hover:border-brand-300"
              >
                {a}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

/* ── Aba Clientes (§10) ────────────────────────────────────────────────── */

function AbaClientes({
  dados, irPara,
}: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const params = useSearchParams();
  const [busca, setBusca] = useState(params.get("qCliente") ?? "");

  return (
    <section aria-label="Clientes" className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <form
          onSubmit={(e) => { e.preventDefault(); irPara({ qCliente: busca || null }); }}
          className="relative w-72"
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar cliente"
            className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </form>
        {dados.clientesIncompletos > 0 && (
          <span className="flex items-center gap-1.5 text-xs text-amber-600">
            <TriangleAlert className="h-3.5 w-3.5" />
            {dados.clientesIncompletos} com cadastro incompleto para cobrança
          </span>
        )}
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1.3fr)_150px_minmax(0,1fr)_110px_110px_120px_100px_130px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>Cliente</span><span className="text-right">MRR</span><span>Serviços</span>
          <span className="text-right">Em aberto</span><span className="text-right">Vencido</span>
          <span className="text-right">Recebido 12m</span><span>Atraso médio</span><span>Perfil pagador</span>
        </div>
        <ul className="m-0 list-none p-0">
          {dados.clientes.map((c) => <LinhaCliente key={c.partyId} c={c} />)}
        </ul>
        {!dados.clientes.length && (
          <div className="flex flex-col items-center gap-1.5 px-5 py-11 text-center">
            <p className="text-sm font-medium text-ink">Nenhum cliente no cadastro financeiro</p>
            <p className="text-xs text-muted">
              O cadastro financeiro é o que permite cobrar sem depender do CRM.
            </p>
          </div>
        )}
      </Card>
    </section>
  );
}

function LinhaCliente({ c }: { c: ClienteFinanceiro }) {
  return (
    <li className="grid items-center gap-3 border-b border-line px-5 py-3 transition-colors hover:bg-subtle lg:grid-cols-[minmax(0,1.3fr)_150px_minmax(0,1fr)_110px_110px_120px_100px_130px]">
      <span className="flex min-w-0 flex-col">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-ink">{c.nome}</span>
          {c.pendencias.length > 0 && (
            <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Cadastro incompleto" />
          )}
        </span>
        <span className="truncate text-[11px] text-muted">
          {c.pendencias.length ? `Falta ${c.pendencias.join(", ")}` : c.desde}
        </span>
      </span>

      {/* MRR aqui é o das recorrências do Financeiro. Sem recorrência, o fee do
          cadastro aparece como auxiliar — são coisas diferentes, e somá-las
          faria a página prometer receita que não tem parcela. */}
      <span className="flex flex-col items-end">
        <span className="text-sm font-semibold text-ink">
          {c.mrrCent > 0 ? brlCheio(c.mrrCent) : "—"}
        </span>
        {c.mrrCent === 0 && c.feeContratadoCent > 0 && (
          <span className="text-[11px] text-muted">{brlCheio(c.feeContratadoCent)} no cadastro</span>
        )}
      </span>

      <span className="flex flex-wrap gap-1">
        {c.servicos.length
          ? c.servicos.map((s) => (
              <span key={s} className="rounded bg-subtle-strong px-1.5 py-0.5 text-[10px] text-muted">{s}</span>
            ))
          : <span className="text-[11px] text-muted">—</span>}
      </span>

      <span className="text-right text-sm text-ink">
        {c.emAbertoCent > 0 ? brlCheio(c.emAbertoCent) : "—"}
      </span>
      <span className={cn("text-right text-sm", c.vencidoCent > 0 ? "font-semibold text-rose-600" : "text-muted")}>
        {c.vencidoCent > 0 ? brlCheio(c.vencidoCent) : "—"}
      </span>
      <span className="text-right text-sm text-ink">
        {c.recebido12Cent > 0 ? brlCheio(c.recebido12Cent) : "—"}
      </span>
      <span className="text-xs text-muted">
        {c.atrasoMedioDias === null ? "—" : `${c.atrasoMedioDias.toFixed(1).replace(".", ",")} d`}
      </span>
      <span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM_CHIP[c.perfilTom])}>
          {c.perfilLabel}
        </span>
      </span>
    </li>
  );
}

/* ── Peças pequenas ────────────────────────────────────────────────────── */

function Numero({
  titulo, valor, nota, tom = "neutro",
}: { titulo: string; valor: string; nota?: string; tom?: string }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-[11px] text-muted">{titulo}</span>
      <span className={cn("text-lg font-semibold tracking-tight",
        tom === "ruim" ? "text-rose-600" : tom === "atencao" ? "text-amber-600" : "text-ink")}>
        {valor}
      </span>
      {nota && <span className="text-[11px] text-muted">{nota}</span>}
    </span>
  );
}

function Aviso({ titulo, texto, tom = "neutro" }: { titulo: string; texto: string; tom?: string }) {
  return (
    <Card className={cn("flex flex-col gap-1 p-5", tom === "atencao" && "border-amber-500/40 bg-amber-500/5")}>
      <p className={cn("text-sm font-semibold", tom === "atencao" ? "text-amber-600" : "text-ink")}>{titulo}</p>
      <p className="text-xs text-muted">{texto}</p>
    </Card>
  );
}

const pct = (n: number) => n.toFixed(1).replace(".", ",");

/** Quem deve na faixa: cliente identificado e parcela sem dono são contas diferentes. */
function quemDeve(dados: Dados, faixa: string): string {
  const clientes = dados.agingClientes[faixa] ?? 0;
  const orfas = dados.agingSemCliente[faixa] ?? 0;
  const partes = [
    clientes ? `${clientes} ${clientes === 1 ? "cliente" : "clientes"}` : null,
    orfas ? `${orfas} sem cliente` : null,
  ].filter(Boolean);
  return partes.length ? partes.join(" · ") : "—";
}
