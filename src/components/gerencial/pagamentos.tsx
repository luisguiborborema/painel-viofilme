"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  Check, ChevronLeft, ChevronRight, Copy, FileText, Plus, Repeat, Search, TriangleAlert,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio } from "@/lib/data/dashboard-financeiro";
import type {
  ContaAPagar, FornecedorLinha, PagamentosView as Dados, RecorrenciaLinha,
} from "@/lib/data/pagamentos-server";
import { PagamentosFicha } from "./pagamentos-ficha";
import { NovoLancamento } from "./novo-lancamento";

/**
 * Pagamentos (spec da página 3) — o lugar de todo dinheiro que sai.
 *
 * As quatro abas respondem perguntas diferentes: o que pagar e com quê
 * (Contas), quanto custa a equipe (Folha), quais são os custos fixos
 * (Recorrências) e com quem se gasta (Fornecedores).
 *
 * Tudo lê `installments` com direção `out` — a fonte que o documento-mãe fixa
 * (§4). Nenhum número é calculado aqui: a tela recebe pronto.
 */

const TOM_SITUACAO: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  ruim: "bg-rose-500/15 text-rose-600",
  atencao: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  roxo: "bg-violet-500/15 text-violet-600",
  neutro: "bg-subtle text-muted",
};

const TOM_LINHA: Record<string, string> = {
  ok: "text-emerald-600",
  ruim: "text-rose-600",
  atencao: "text-amber-600",
  neutro: "text-muted",
};

const ABAS = [
  { key: "contas", label: "Contas a pagar" },
  { key: "folha", label: "Folha" },
  { key: "recorrencias", label: "Recorrências" },
  { key: "fornecedores", label: "Fornecedores" },
];

export function PagamentosView({ dados, aba }: { dados: Dados; aba: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, revalidar] = useTransition();
  // A ficha é overlay da PÁGINA, não da tabela: qualquer aba pode abri-la.
  const [ficha, setFicha] = useState<string | null>(null);
  const [novo, setNovo] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState(aba);
  const recarregar = () => revalidar(() => router.refresh());

  useEffect(() => { setAbaAtiva(aba); }, [aba]);

  /** Um só caminho para mexer na URL: filtro é estado compartilhável. */
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
      <Cabecalho onNovo={() => setNovo(true)} />

      {dados.pendente ? (
        <Aviso
          titulo="Falta rodar a migração."
          texto="Pagamentos lê o núcleo transacional (parties, documents, installments, settlements), criado por 0149_nucleo_transacional.sql. Rode no Supabase e recarregue."
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
                onClick={() => irPara({ aba: a.key })}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
                  abaAtiva === a.key
                    ? "border-brand-500 font-semibold text-ink"
                    : "border-transparent text-muted hover:text-ink",
                )}
              >
                {a.label}
                {a.key === "folha" && dados.notasPendentes > 0 && (
                  <span className="rounded-full bg-subtle-strong px-2 text-[11px] font-semibold text-muted">
                    {dados.notasPendentes} NFs pendentes
                  </span>
                )}
              </button>
            ))}
          </div>

          {abaAtiva === "contas" && <AbaContas dados={dados} irPara={irPara} onAbrirFicha={setFicha} />}
          {abaAtiva === "folha" && <AbaFolha dados={dados} />}
          {abaAtiva === "recorrencias" && <AbaRecorrencias dados={dados} />}
          {abaAtiva === "fornecedores" && <AbaFornecedores dados={dados} />}

          {novo && (
            <NovoLancamento
              direcao="out"
              contrapartes={dados.opcoes.fornecedores}
              categorias={dados.opcoes.categorias}
              contas={dados.opcoes.contas}
              onFechar={() => setNovo(false)}
              onPronto={() => { setNovo(false); recarregar(); }}
            />
          )}

          {ficha && (
            <PagamentosFicha
              key={ficha}
              id={ficha}
              onFechar={() => setFicha(null)}
              onMudou={recarregar}
            />
          )}
        </>
      )}
    </div>
  );
}

/* ── Cabeçalho (§3) ────────────────────────────────────────────────────── */

function Cabecalho({ onNovo }: { onNovo: () => void }) {
  const aviso = () =>
    toast("A leitura de boleto e NF por IA ainda não existe: lance a despesa manualmente.", "error");
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs text-muted">Financeiro</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Pagamentos</h1>
        <p className="mt-1 text-sm text-muted">
          Tudo o que sai: contas, folha, custos fixos e fornecedores.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={aviso}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium text-ink transition-colors hover:border-brand-300"
        >
          <FileText className="h-4 w-4" />
          Lançar de arquivo
        </button>
        <button
          type="button"
          onClick={onNovo}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
        >
          <Plus className="h-4 w-4" />
          Nova despesa
        </button>
      </div>
    </header>
  );
}

/* ── Faixa de indicadores (§4) ─────────────────────────────────────────── */

function Indicadores({ dados, irPara }: { dados: Dados; irPara: (p: Record<string, string | null>) => void }) {
  const i = dados.indicadores;
  const cartao = "flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 text-left shadow-sm transition-colors hover:border-brand-300";

  return (
    <section aria-label="Indicadores" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button type="button" className={cartao} onClick={() => irPara({ aba: "contas", visao: "aberto" })}>
        <span className="text-xs text-muted">A pagar em {dados.mesLabel.split(" de ")[0]}</span>
        <span className="text-2xl font-semibold tracking-tight text-ink">{brlCheio(i.aPagarCent)}</span>
        <span className="text-xs text-muted">{i.aPagarContexto}</span>
      </button>

      <button type="button" className={cartao} onClick={() => irPara({ aba: "contas", visao: "pagas" })}>
        <span className="text-xs text-muted">Pago em {dados.mesLabel.split(" de ")[0]}</span>
        <span className="text-2xl font-semibold tracking-tight text-ink">{brlCheio(i.pagoCent)}</span>
        <span className="flex h-1.5 overflow-hidden rounded-full bg-subtle-strong">
          <span className="bg-sky-500" style={{ width: `${Math.min(100, i.pagoPct)}%` }} />
        </span>
        <span className="text-xs text-muted">{i.pagoContexto}</span>
      </button>

      <button type="button" className={cartao} onClick={() => irPara({ aba: "contas", visao: "vencidas" })}>
        <span className="text-xs text-muted">Vencido</span>
        <span className={cn("text-2xl font-semibold tracking-tight", i.vencidoCent > 0 ? "text-rose-600" : "text-ink")}>
          {brlCheio(i.vencidoCent)}
        </span>
        <span className="text-xs text-muted">{i.vencidoContexto}</span>
      </button>

      <button type="button" className={cartao} onClick={() => irPara({ aba: "contas", visao: "aberto" })}>
        <span className="text-xs text-muted">Próximos 7 dias</span>
        <span className="text-2xl font-semibold tracking-tight text-ink">{brlCheio(i.proximos7Cent)}</span>
        {/* A cobertura é o que o total sozinho não responde: dá para pagar?
            Sem nada a pagar na janela, ela não é alerta — é irrelevante, e
            pintar de vermelho "nada a pagar" assusta à toa. */}
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            i.proximos7Cent === 0 ? "text-muted"
              : i.cobertura.coberto ? "text-emerald-600" : "text-rose-600",
          )}
        >
          {i.proximos7Cent > 0 &&
            (i.cobertura.coberto
              ? <Check className="h-3.5 w-3.5" />
              : <TriangleAlert className="h-3.5 w-3.5" />)}
          {i.coberturaTexto}
        </span>
      </button>
    </section>
  );
}

/* ── Aba Contas a pagar (§5) ───────────────────────────────────────────── */

function AbaContas({
  dados, irPara, onAbrirFicha,
}: {
  dados: Dados;
  irPara: (p: Record<string, string | null>) => void;
  onAbrirFicha: (id: string) => void;
}) {
  const params = useSearchParams();
  const visao = params.get("visao") ?? "aberto";
  const chip = params.get("chip");
  const agrupar = params.get("agrupar") ?? "nenhum";
  const [busca, setBusca] = useState(params.get("q") ?? "");

  function mudarMes(delta: number) {
    const [a, m] = dados.mesIso.split("-").map(Number);
    const d = new Date(Date.UTC(a, m - 1 + delta, 1));
    irPara({ mes: d.toISOString().slice(0, 7) });
  }

  return (
    <section aria-label="Contas a pagar" className="space-y-4">
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
              <span className="text-[11px] text-muted">{v.total}</span>
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
          <label className="flex items-center gap-2 text-xs text-muted">
            Agrupar
            <select
              value={agrupar}
              onChange={(e) => irPara({ agrupar: e.target.value })}
              className="h-9 rounded-lg border border-line bg-surface px-2 text-sm text-ink outline-none focus:border-brand-400"
            >
              <option value="nenhum">Nenhum</option>
              <option value="categoria">Por categoria</option>
              <option value="forma">Por forma de pagamento</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); irPara({ q: busca || null }); }}
          className="relative w-64"
        >
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar fornecedor, descrição ou valor"
            className="h-9 w-full rounded-xl border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none focus:border-brand-400"
          />
        </form>
        {dados.chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => irPara({ chip: chip === c.key ? null : c.key })}
            aria-pressed={chip === c.key}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors",
              chip === c.key
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {c.label}
            <span className={cn("text-[11px]", chip === c.key ? "text-white/70" : "text-muted")}>{c.total}</span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[100px_150px_minmax(0,1fr)_180px_120px_150px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>Vencimento</span><span>Fornecedor</span><span>Descrição e categoria</span>
          <span>Situação</span><span className="text-right">Valor</span><span />
        </div>

        {dados.grupos.map((g, n) => (
          <div key={g.nome ?? n}>
            {g.nome && (
              <div className="flex justify-between border-b border-line bg-subtle px-5 py-2 text-xs">
                <span className="font-semibold text-ink">{g.nome}</span>
                <span className="text-muted">{g.subtitulo}</span>
              </div>
            )}
            <ul className="m-0 list-none p-0">
              {g.contas.map((c) => <LinhaConta key={c.id} c={c} onAbrir={onAbrirFicha} />)}
            </ul>
          </div>
        ))}

        {!dados.totalNoFiltro && (
          <div className="flex flex-col items-center gap-1.5 px-5 py-11 text-center">
            <p className="text-sm font-medium text-ink">Nada por aqui neste filtro</p>
            <p className="text-xs text-muted">Troque a visão, o mês ou limpe os filtros.</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-subtle px-5 py-3 text-xs text-muted">
          <span>{dados.totalNoFiltro} {dados.totalNoFiltro === 1 ? "conta" : "contas"} neste filtro</span>
          <span className="flex flex-wrap gap-5">
            <span>Total <b className="text-ink">{brlCheio(dados.rodape.totalCent)}</b></span>
            <span>Em aberto <b className="text-ink">{brlCheio(dados.rodape.abertoCent)}</b></span>
            <span>Pago <b className="text-sky-600">{brlCheio(dados.rodape.pagoCent)}</b></span>
            <span>Vencido <b className="text-rose-600">{brlCheio(dados.rodape.vencidoCent)}</b></span>
          </span>
        </div>
      </Card>
    </section>
  );
}

function LinhaConta({ c, onAbrir }: { c: ContaAPagar; onAbrir: (id: string) => void }) {
  function copiar() {
    if (!c.copiavel) return;
    navigator.clipboard?.writeText(c.copiavel);
    toast(
      c.linhaPagamento.texto === "Boleto, favorecido diferente"
        ? "Código copiado. Atenção: o favorecido do boleto é diferente do fornecedor."
        : "Código de pagamento copiado.",
      c.linhaPagamento.texto === "Boleto, favorecido diferente" ? "error" : "success",
    );
  }

  return (
    <li className="grid items-center gap-3 border-b border-line px-5 py-3 transition-colors hover:bg-subtle lg:grid-cols-[100px_150px_minmax(0,1fr)_180px_120px_150px] lg:py-0" style={{ minHeight: 66 }}>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-ink">{c.vencimentoLabel}</span>
        <span className={cn("text-[11px]", TOM_LINHA[c.relativoTom])}>{c.relativo}</span>
      </span>

      <span className="truncate text-sm font-semibold text-ink">{c.fornecedor}</span>

      <button
        type="button"
        onClick={() => onAbrir(c.id)}
        className="flex min-w-0 flex-col items-start gap-0.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm text-ink">{c.descricao}</span>
          {c.recorrente && <Repeat className="h-3 w-3 shrink-0 text-muted" aria-label="Recorrência" />}
          {c.parcelaLabel && (
            <span className="shrink-0 rounded bg-subtle-strong px-1.5 text-[10px] font-semibold text-muted">
              {c.parcelaLabel}
            </span>
          )}
        </span>
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-[11px] text-muted">{c.categoria}</span>
          {c.cliente && (
            <span className="shrink-0 rounded bg-sky-500/10 px-1.5 text-[10px] font-semibold text-sky-600">
              {c.cliente}
            </span>
          )}
        </span>
      </button>

      <span className="flex flex-col items-start gap-1">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM_SITUACAO[c.situacaoTom])}>
          {c.situacaoLabel}
        </span>
        <span className={cn("flex items-center gap-1.5 text-[11px]", TOM_LINHA[c.linhaPagamento.tom])}>
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
          {c.linhaPagamento.texto}
        </span>
      </span>

      <span className="flex flex-col items-end gap-0.5">
        <span className={cn("text-sm font-semibold text-ink", c.estimada && "italic text-muted")}>
          {c.estimada ? "~ " : ""}{brlCheio(c.paga ? c.valorCent : c.saldoCent)}
        </span>
        {c.subValor && <span className="text-[11px] text-muted">{c.subValor}</span>}
      </span>

      <span className="flex items-center justify-end gap-1.5">
        {c.copiavel && (
          <button
            type="button"
            onClick={copiar}
            aria-label="Copiar código de pagamento"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ink"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onAbrir(c.id)}
          className="inline-flex h-8 items-center rounded-lg border border-line px-3 text-xs font-medium text-ink transition-colors hover:bg-subtle-strong"
        >
          {c.acaoLabel}
        </button>
      </span>
    </li>
  );
}

/* ── Aba Folha (§11) ───────────────────────────────────────────────────── */

function AbaFolha({ dados }: { dados: Dados }) {
  const f = dados.folha;
  if (f.semEquipe) {
    return (
      <Vazio
        titulo="Nenhum colaborador cadastrado"
        texto="A Folha lê a equipe de RH & Cultura. Cadastre as pessoas com remuneração e tipo de contrato para o ciclo mensal aparecer aqui."
        href="/gerencial/rh"
        acao="Abrir RH & Cultura"
      />
    );
  }

  return (
    <section aria-label="Folha" className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Numero rotulo="Custo da equipe no mês" valor={brlCheio(f.totalCent)} />
        <Numero rotulo="NFs recebidas" valor={f.notasRecebidas} />
        <Numero rotulo="Pagos" valor={f.pagos} />
        <Numero rotulo="Total a pagar" valor={brlCheio(f.totalCent)} />
      </div>

      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_140px_140px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>Colaborador</span><span className="text-right">Contrato</span>
          <span className="text-right">Ajustes</span><span className="text-right">Total a pagar</span>
          <span>NF da PJ</span>
        </div>
        {f.grupos.map((g) => (
          <div key={g.nome}>
            <div className="flex justify-between border-b border-line bg-subtle px-5 py-2 text-xs">
              <span className="font-semibold text-ink">{g.nome}</span>
              <span className="text-muted">{g.subtitulo}</span>
            </div>
            <ul className="m-0 list-none p-0">
              {g.pessoas.map((p) => (
                <li key={p.id} className="grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[minmax(0,1fr)_120px_120px_140px_140px]">
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold text-ink">{p.nome}</span>
                    <span className="text-[11px] text-muted">{p.subtitulo}</span>
                  </span>
                  <span className="text-right text-sm text-ink">{brlCheio(p.contratoCent)}</span>
                  <span className="text-right text-sm text-muted">{p.ajustesDescricao}</span>
                  <span className="text-right text-sm font-semibold text-ink">{brlCheio(p.totalCent)}</span>
                  <span className={cn("text-xs", p.notaLabel === "Pendente" ? "text-amber-600" : "text-muted")}>
                    {p.notaLabel}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="border-t border-line bg-subtle px-5 py-3 text-[11px] text-muted">
          Reembolsos não entram no custo da equipe. Adiantamentos já pagos são abatidos do total.
        </p>
      </Card>
    </section>
  );
}

/* ── Aba Recorrências (§12) ────────────────────────────────────────────── */

function AbaRecorrencias({ dados }: { dados: Dados }) {
  if (!dados.recorrencias.length) {
    return (
      <Vazio
        titulo="Nenhuma recorrência de despesa cadastrada"
        texto="Custos fixos e assinaturas viram recorrências, que geram as parcelas dos próximos meses sozinhas. A folha é gerida na aba Folha e não aparece aqui."
      />
    );
  }
  return (
    <section aria-label="Recorrências" className="space-y-4">
      <div className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-subtle px-5 py-4">
        <span className="flex flex-col">
          <span className="text-[11px] text-muted">Custo fixo mensal</span>
          <span className="text-lg font-semibold text-ink">{brlCheio(dados.custoFixoCent)}</span>
        </span>
        <span className="flex flex-col">
          <span className="text-[11px] text-muted">Ativas</span>
          <span className="text-lg font-semibold text-ink">
            {dados.recorrencias.filter((r) => r.status === "active").length}
          </span>
        </span>
        <span className="text-xs text-muted">A folha é gerida na aba Folha e não aparece aqui.</span>
      </div>
      <Card className="overflow-hidden">
        <ul className="m-0 list-none p-0">
          {dados.recorrencias.map((r) => <LinhaRecorrencia key={r.id} r={r} />)}
        </ul>
      </Card>
    </section>
  );
}

function LinhaRecorrencia({ r }: { r: RecorrenciaLinha }) {
  return (
    <li className="grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[170px_minmax(0,1fr)_170px_130px_70px_130px]">
      <span className="truncate text-sm font-semibold text-ink">{r.fornecedor}</span>
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm text-ink">{r.descricao}</span>
        <span className="text-[11px] text-muted">{r.vigencia}</span>
      </span>
      <span className="truncate text-xs text-muted">{r.categoria}</span>
      <span className={cn("text-right text-sm font-semibold", r.estimada ? "italic text-muted" : "text-ink")}>
        {r.estimada ? "~ " : ""}{brlCheio(r.valorCent)}
      </span>
      <span className="text-xs text-muted">dia {r.dia}</span>
      <span className="text-xs text-muted">{r.forma}</span>
    </li>
  );
}

/* ── Aba Fornecedores (§13) ────────────────────────────────────────────── */

function AbaFornecedores({ dados }: { dados: Dados }) {
  if (!dados.fornecedores.length) {
    return (
      <Vazio
        titulo="Nenhum fornecedor cadastrado"
        texto="As despesas de hoje vieram sem fornecedor — o campo era texto livre e estava vazio. Cada conta nova com fornecedor cadastrado herda os dados de pagamento dele, que é o que faz o ciclo copiar → pagar → baixar levar segundos."
      />
    );
  }
  return (
    <section aria-label="Fornecedores" className="space-y-4">
      {dados.fornecedoresSemDados > 0 && (
        <p className="flex items-center gap-2 text-xs text-amber-600">
          <TriangleAlert className="h-4 w-4" />
          {dados.fornecedoresSemDados} sem dados de pagamento. Novas contas vão chegar sem código para copiar.
        </p>
      )}
      <Card className="overflow-hidden">
        <div className="hidden grid-cols-[minmax(0,1fr)_110px_170px_130px_110px_140px] gap-3 border-b border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
          <span>Fornecedor</span><span>Tipo</span><span>Categoria principal</span>
          <span className="text-right">Gasto</span><span className="text-right">Em aberto</span><span>Próximo</span>
        </div>
        <ul className="m-0 list-none p-0">
          {dados.fornecedores.map((f) => <LinhaFornecedor key={f.id} f={f} />)}
        </ul>
      </Card>
    </section>
  );
}

function LinhaFornecedor({ f }: { f: FornecedorLinha }) {
  return (
    <li className="grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[minmax(0,1fr)_110px_170px_130px_110px_140px]">
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-sm font-semibold text-ink">{f.nome}</span>
        {f.semDados && <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Faltam dados de pagamento" />}
      </span>
      <span className="text-xs text-muted">{f.tipo}</span>
      <span className="truncate text-xs text-muted">{f.categoriaPrincipal}</span>
      <span className="text-right text-sm font-semibold text-ink">{brlCheio(f.gasto12Cent)}</span>
      <span className={cn("text-right text-sm", f.vencido ? "text-rose-600" : "text-ink")}>
        {brlCheio(f.emAbertoCent)}
      </span>
      <span className="text-xs text-muted">{f.proximo ?? "—"}</span>
    </li>
  );
}

/* ── Peças comuns ──────────────────────────────────────────────────────── */

function Numero({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <span className="text-xs text-muted">{rotulo}</span>
      <span className="text-xl font-semibold tracking-tight text-ink">{valor}</span>
    </div>
  );
}

function Vazio({
  titulo, texto, href, acao,
}: { titulo: string; texto: string; href?: string; acao?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-12 text-center">
      <p className="text-sm font-semibold text-ink">{titulo}</p>
      <p className="max-w-lg text-xs leading-relaxed text-muted">{texto}</p>
      {href && acao && (
        <Link href={href} className="mt-1 text-xs font-medium text-brand-600 hover:underline">
          {acao}
        </Link>
      )}
    </div>
  );
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-ink">
      <p className="font-medium">{titulo}</p>
      <p className="mt-1 text-muted">{texto}</p>
    </div>
  );
}
