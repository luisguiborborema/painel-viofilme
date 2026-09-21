"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio, hojeSP } from "@/lib/data/dashboard-financeiro";
import type { Ficha } from "@/app/api/gerencial/dashboard-financeiro/ficha/route";

/**
 * Ficha universal (spec §10.1) e baixa rápida (§10.2).
 *
 * As duas ações escrevem pelos MESMOS endpoints das páginas de origem
 * (`/api/gerencial/expenses` e `/api/gerencial/receivables`). Isso não é
 * economia de código: é o §14 — a baixa feita aqui passa pela alçada de
 * aprovação, pela trava de período fechado e pela auditoria, exatamente como
 * passaria lá. Um atalho próprio seria um atalho sem registro.
 */

export type AlvoFicha = { id: string; direcao: "in" | "out" };

const TOM: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  atencao: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  neutro: "bg-subtle text-muted",
};

export function DashboardFicha({
  alvo,
  onFechar,
  onMudou,
}: {
  alvo: AlvoFicha;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [baixa, setBaixa] = useState(false);

  // O pai monta um componente por alvo (`key`), então o estado já nasce limpo:
  // zerar aqui dentro dispararia um render em cascata a cada abertura.
  useEffect(() => {
    let vivo = true;
    fetch(`/api/gerencial/dashboard-financeiro/ficha?id=${encodeURIComponent(alvo.id)}&direcao=${alvo.direcao}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok) setErro(j?.error ?? "Não foi possível abrir a ficha.");
        else setFicha(j as Ficha);
      })
      .catch(() => vivo && setErro("Não foi possível abrir a ficha."));
    return () => { vivo = false; };
  }, [alvo]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !baixa && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar, baixa]);

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <button
          type="button"
          aria-label="Fechar ficha"
          onClick={onFechar}
          className="absolute inset-0 bg-black/50"
        />
        <aside
          aria-label="Ficha do lançamento"
          className="relative flex h-full w-full max-w-[480px] flex-col border-l border-line bg-surface"
        >
          {!ficha && !erro && (
            <div className="flex flex-1 items-center justify-center text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {erro && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted">{erro}</p>
              <button type="button" onClick={onFechar} className="text-sm font-medium text-brand-600">
                Fechar
              </button>
            </div>
          )}
          {ficha && (
            <>
              <Cabecalho ficha={ficha} onFechar={onFechar} />
              <Corpo ficha={ficha} />
              <Rodape
                ficha={ficha}
                onBaixar={() => setBaixa(true)}
                onMudou={() => { onMudou(); onFechar(); }}
              />
            </>
          )}
        </aside>
      </div>

      {ficha && baixa && (
        <BaixaRapida
          ficha={ficha}
          onFechar={() => setBaixa(false)}
          onPronto={() => { setBaixa(false); onMudou(); onFechar(); }}
        />
      )}
    </>
  );
}

/* ── Cabeçalho ─────────────────────────────────────────────────────────── */

function Cabecalho({ ficha, onFechar }: { ficha: Ficha; onFechar: () => void }) {
  return (
    <div className="flex flex-col gap-3 border-b border-line p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{ficha.tipo}</span>
        <button
          type="button"
          aria-label="Fechar"
          onClick={onFechar}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted transition-colors hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <p className="text-xl font-semibold tracking-tight text-ink">{ficha.pessoa}</p>
        {ficha.descricao !== ficha.pessoa && (
          <p className="text-sm text-muted">{ficha.descricao}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "text-2xl font-semibold tracking-tight",
            ficha.direcao === "in" ? "text-emerald-600" : "text-ink",
          )}
        >
          {ficha.valorLabel}
        </span>
        {ficha.selos.map((s) => (
          <span key={s.label} className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM[s.tom])}>
            {s.label}
          </span>
        ))}
      </div>
      <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-muted">{ficha.origem}</p>
    </div>
  );
}

/* ── Corpo ─────────────────────────────────────────────────────────────── */

function Corpo({ ficha }: { ficha: Ficha }) {
  const campos = [
    { rotulo: "Vencimento", valor: ficha.vencimento },
    { rotulo: "Competência", valor: ficha.competencia },
    { rotulo: "Parcela", valor: ficha.parcela },
    { rotulo: "Conta prevista", valor: ficha.conta },
  ];

  return (
    <div className="flex-1 space-y-6 overflow-auto p-5">
      <div className="grid grid-cols-2 gap-x-5 gap-y-3">
        {campos.map((c) => (
          <div key={c.rotulo}>
            <p className="text-[11px] text-muted">{c.rotulo}</p>
            <p className="text-sm font-medium text-ink">{c.valor}</p>
          </div>
        ))}
      </div>

      {ficha.encargos && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-ink">
          Em atraso: {ficha.encargos}. A baixa registra o valor da parcela — o encargo é lançado à parte.
        </p>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Itens</h3>
        {ficha.itens.map((i, n) => (
          <div key={n} className="flex justify-between gap-4 rounded-xl border border-line p-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{i.categoria}</p>
              <p className="text-xs text-muted">{i.dimensoes}</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-ink">{i.valor}</span>
          </div>
        ))}
      </section>

      {ficha.cobranca && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Cobrança</h3>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
            <span className="text-xs text-muted">{ficha.cobranca.texto}</span>
            {ficha.cobranca.link && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(ficha.cobranca!.link!);
                  toast("Link da cobrança copiado.", "success");
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink transition-colors hover:bg-subtle"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar link
              </button>
            )}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Histórico</h3>
        {ficha.historico.length ? (
          <ol className="space-y-2">
            {ficha.historico.map((h, n) => (
              <li key={n} className="grid grid-cols-[48px_1fr] gap-2 text-xs">
                <span className="text-muted">{h.quando}</span>
                <span className="text-ink">{h.texto}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted">Sem eventos registrados nesta parcela.</p>
        )}
      </section>
    </div>
  );
}

/* ── Rodapé ────────────────────────────────────────────────────────────── */

function Rodape({
  ficha,
  onBaixar,
  onMudou,
}: {
  ficha: Ficha;
  onBaixar: () => void;
  onMudou: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function aprovar() {
    setOcupado(true);
    const res = await fetch("/api/gerencial/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", id: ficha.id }),
    }).catch(() => null);
    setOcupado(false);
    const j = await res?.json().catch(() => null);
    if (!res?.ok) {
      toast(j?.error ?? "Não foi possível aprovar.");
      return;
    }
    toast(`Despesa aprovada: ${ficha.pessoa}.`, "success");
    onMudou();
  }

  return (
    <div className="space-y-2 border-t border-line p-4">
      {ficha.bloqueioBaixa && <p className="text-xs text-muted">{ficha.bloqueioBaixa}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onBaixar}
          disabled={!ficha.podeBaixar}
          className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {ficha.acaoPrincipal}
        </button>
        {ficha.podeAprovar && (
          <button
            type="button"
            onClick={aprovar}
            disabled={ocupado}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-subtle disabled:opacity-50"
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprovar
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Baixa rápida (§10.2) ──────────────────────────────────────────────── */

function BaixaRapida({
  ficha,
  onFechar,
  onPronto,
}: {
  ficha: Ficha;
  onFechar: () => void;
  onPronto: () => void;
}) {
  const hoje = hojeSP();
  const [data, setData] = useState(hoje);
  const [conta, setConta] = useState(ficha.contaId ?? ficha.contas[0]?.id ?? "");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  // Data futura é erro de digitação, não intenção: baixa é fato consumado.
  const dataInvalida = data > hoje;

  async function confirmar() {
    if (dataInvalida) return;
    setOcupado(true);
    const entrada = ficha.direcao === "in";
    const res = await fetch(entrada ? "/api/gerencial/receivables" : "/api/gerencial/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        entrada
          ? { action: "receive", id: ficha.id, paymentDate: data }
          : { action: "pay", id: ficha.id, paidDate: data },
      ),
    }).catch(() => null);
    setOcupado(false);

    const j = await res?.json().catch(() => null);
    if (!res?.ok) {
      toast(j?.error ?? "Não foi possível registrar a baixa.");
      return;
    }
    const nomeConta = ficha.contas.find((c) => c.id === conta)?.nome;
    toast(
      `${entrada ? "Recebimento" : "Pagamento"} registrado: ${ficha.pessoa}, ${brlCheio(ficha.valorCent)}.` +
        (nomeConta ? ` Aguardando confirmação no extrato ${nomeConta}.` : ""),
      "success",
    );
    onPronto();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-black/60" />
      <div
        role="dialog"
        aria-label={ficha.acaoPrincipal}
        className="relative w-full max-w-md space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-xl"
      >
        <div>
          <h2 className="text-lg font-semibold text-ink">{ficha.acaoPrincipal}</h2>
          <p className="text-xs text-muted">
            {ficha.descricao === ficha.pessoa
              ? ficha.pessoa
              : `${ficha.pessoa}, ${ficha.descricao.toLowerCase()}`}
            . Saldo de {brlCheio(ficha.valorCent)}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-[11px] text-muted">
            Data
            <input
              type="date"
              value={data}
              max={hoje}
              onChange={(e) => setData(e.target.value)}
              className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[11px] text-muted">
            Valor
            <input
              type="text"
              readOnly
              value={brlCheio(ficha.valorCent)}
              title="A baixa registra o saldo cheio da parcela — baixa parcial ainda não existe neste modelo."
              className="h-10 cursor-not-allowed rounded-xl border border-line bg-subtle px-3 text-sm text-muted outline-none"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5 text-[11px] text-muted">
          Conta
          <select
            value={conta}
            onChange={(e) => setConta(e.target.value)}
            className="h-10 rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400"
          >
            {!ficha.contas.length && <option value="">Nenhuma conta cadastrada</option>}
            {ficha.contas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>

        {ficha.encargos && (
          <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-muted">
            Em atraso: {ficha.encargos}. Lance o encargo como um item à parte.
          </p>
        )}
        {dataInvalida && <p className="text-xs text-rose-600">A data da baixa não pode ser no futuro.</p>}

        <button
          type="button"
          disabled
          title="O anexo de comprovante fica na página de origem do lançamento."
          className="flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-dashed border-line text-xs text-muted opacity-60"
        >
          <Paperclip className="h-4 w-4" />
          Anexar comprovante — na página do lançamento
        </button>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onFechar}
            className="h-10 rounded-xl border border-line px-4 text-sm text-ink transition-colors hover:bg-subtle"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={ocupado || dataInvalida}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
            {ficha.direcao === "in" ? "Confirmar recebimento" : "Confirmar pagamento"}
          </button>
        </div>
      </div>
    </div>
  );
}
