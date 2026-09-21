"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, TriangleAlert, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio, hojeSP } from "@/lib/data/dashboard-financeiro";
import { diferencaDoEstimado, repartirPagamento } from "@/lib/data/pagamentos";
import type { FichaPagamento } from "@/app/api/gerencial/pagamentos/ficha/route";

/**
 * Ficha da conta a pagar (spec §7) e os dois modais que operam sobre ela:
 * registrar pagamento (§8) e informar valor real (§9).
 *
 * Nenhuma decisão de permissão é tomada aqui: o servidor devolve `podePagar`,
 * `bloqueioPagar` e `podeAprovar` já resolvidos. A tela obedece — e continua
 * obedecendo quando a regra mudar.
 */

const TOM: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  ruim: "bg-rose-500/15 text-rose-600",
  atencao: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  roxo: "bg-violet-500/15 text-violet-600",
  neutro: "bg-subtle text-muted",
};
const TOM_TEXTO: Record<string, string> = {
  ok: "text-emerald-600", ruim: "text-rose-600",
  atencao: "text-amber-600", neutro: "text-muted",
};

async function acao(body: Record<string, unknown>): Promise<string | null> {
  const res = await fetch("/api/gerencial/pagamentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const j = await res?.json().catch(() => null);
  if (!res?.ok) return j?.error ?? "Não foi possível concluir a ação.";
  return null;
}

export function PagamentosFicha({
  id,
  onFechar,
  onMudou,
}: {
  id: string;
  onFechar: () => void;
  onMudou: () => void;
}) {
  const [f, setF] = useState<FichaPagamento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState<"pagar" | "valor" | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/gerencial/pagamentos/ficha?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok) setErro(j?.error ?? "Não foi possível abrir a ficha.");
        else setF(j as FichaPagamento);
      })
      .catch(() => vivo && setErro("Não foi possível abrir a ficha."));
    return () => { vivo = false; };
  }, [id]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !modal && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar, modal]);

  const pronto = () => { onMudou(); onFechar(); };

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <button type="button" aria-label="Fechar ficha" onClick={onFechar} className="absolute inset-0 bg-black/50" />
        <aside
          aria-label="Ficha da conta a pagar"
          className="relative flex h-full w-full max-w-[600px] flex-col border-l border-line bg-surface"
        >
          {!f && !erro && (
            <div className="flex flex-1 items-center justify-center text-muted">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {erro && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="text-sm text-muted">{erro}</p>
              <button type="button" onClick={onFechar} className="text-sm font-medium text-brand-600">Fechar</button>
            </div>
          )}
          {f && (
            <>
              <Cabecalho f={f} onFechar={onFechar} />
              <Corpo f={f} />
              <Rodape f={f} onPagar={() => setModal("pagar")} onValor={() => setModal("valor")} onMudou={pronto} />
            </>
          )}
        </aside>
      </div>

      {f && modal === "pagar" && (
        <ModalPagar f={f} onFechar={() => setModal(null)} onPronto={pronto} />
      )}
      {f && modal === "valor" && (
        <ModalValorReal f={f} onFechar={() => setModal(null)} onPronto={pronto} />
      )}
    </>
  );
}

/* ── Cabeçalho (§7.1) ──────────────────────────────────────────────────── */

function Cabecalho({ f, onFechar }: { f: FichaPagamento; onFechar: () => void }) {
  return (
    <div className="space-y-3 border-b border-line p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">Conta a pagar</span>
        <button
          type="button" aria-label="Fechar" onClick={onFechar}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-muted hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div>
        <p className="text-xl font-semibold tracking-tight text-ink">{f.fornecedor}</p>
        {f.descricao !== f.fornecedor && <p className="text-sm text-muted">{f.descricao}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("text-2xl font-semibold tracking-tight text-ink", f.estimada && "italic text-muted")}>
          {f.estimada ? "~ " : ""}{brlCheio(f.saldoCent || f.valorCent)}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM[f.situacaoTom])}>
          {f.situacaoLabel}
        </span>
        <span className={cn("text-[11px]", TOM_TEXTO[f.linhaPagamento.tom])}>{f.linhaPagamento.texto}</span>
      </div>
      <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-muted">{f.origem}</p>
    </div>
  );
}

/* ── Corpo (§7.2) ──────────────────────────────────────────────────────── */

function Corpo({ f }: { f: FichaPagamento }) {
  return (
    <div className="flex-1 space-y-6 overflow-auto p-5">
      {/* Dados de pagamento vêm primeiro: é o que a pessoa veio buscar. */}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Dados de pagamento</h3>
        {f.favorecidoDivergente && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-ink">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" />
            Favorecido diferente do fornecedor. Confirme com ele antes de pagar — há casos
            legítimos, como intermediadoras, mas trocar a conta de destino é golpe comum.
          </p>
        )}
        {f.dadosPagamento.length ? (
          f.dadosPagamento.map((d) => (
            <div key={d.rotulo} className="flex items-center justify-between gap-3 rounded-xl border border-line p-3">
              <span className="min-w-0">
                <span className="block text-[11px] text-muted">{d.rotulo}</span>
                <span className="block truncate font-mono text-xs text-ink">{d.valor}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(d.valor);
                  toast(
                    f.favorecidoDivergente
                      ? "Copiado. Atenção: o favorecido é diferente do fornecedor."
                      : `${d.rotulo} copiado.`,
                    f.favorecidoDivergente ? "error" : "success",
                  );
                }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs text-ink hover:bg-subtle"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </button>
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-ink">
            {f.estimada
              ? "Guia ainda não emitida. Use “Informar valor real” quando ela sair."
              : "Sem dados de pagamento. Cadastre-os no fornecedor para que as próximas contas já venham com o código."}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-x-5 gap-y-3">
        {[
          { r: "Vencimento", v: f.vencimento },
          { r: "Programada para", v: f.programadaPara ?? "Não programada" },
          { r: "Competência", v: f.competencia },
          { r: "Parcela", v: f.parcela },
        ].map((c) => (
          <div key={c.r}>
            <p className="text-[11px] text-muted">{c.r}</p>
            <p className={cn("text-sm font-medium text-ink", c.v === "Não programada" && "text-amber-600")}>{c.v}</p>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Itens e rateio</h3>
        {f.itens.map((i, n) => (
          <div key={n} className="flex justify-between gap-4 rounded-xl border border-line p-3">
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{i.categoria}</span>
              <span className="block text-xs text-muted">{i.dimensoes}</span>
            </span>
            <span className="shrink-0 text-sm font-semibold text-ink">{i.valor}</span>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Documentos</h3>
        <div className="grid grid-cols-3 gap-2">
          {f.documentos.map((d) => (
            <div
              key={d.kind}
              className={cn(
                "rounded-xl px-3 py-4 text-center text-[11px]",
                d.anexado
                  ? "border border-emerald-500/50 text-emerald-600"
                  : d.obrigatorio
                    ? "border border-dashed border-amber-500/60 text-amber-600"
                    : "border border-dashed border-line text-muted",
              )}
            >
              {d.rotulo}
              {!d.anexado && d.obrigatorio && (
                <span className="mt-1 block font-semibold">Obrigatório antes de pagar</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted">
          O anexo é feito na página do lançamento — aqui a ficha só mostra o que falta.
        </p>
      </section>

      {f.baixas.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-ink">Pagamentos</h3>
          {f.baixas.map((b, n) => (
            <div key={n} className="flex justify-between gap-3 rounded-xl border border-line p-3 text-xs">
              <span className="text-muted">
                {b.data}{b.conta && ` · ${b.conta}`}
                {b.encargos && <span className="block text-amber-600">{b.encargos}</span>}
              </span>
              <span className="font-semibold text-ink">{b.valor}</span>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-ink">Histórico</h3>
        {f.historico.length ? (
          <ol className="space-y-2">
            {f.historico.map((h, n) => (
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
  f, onPagar, onValor, onMudou,
}: {
  f: FichaPagamento; onPagar: () => void; onValor: () => void; onMudou: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function aprovar() {
    setOcupado(true);
    const e = await acao({ action: "aprovar", installmentId: f.id });
    setOcupado(false);
    if (e) { toast(e); return; }
    toast(`Despesa aprovada: ${f.fornecedor}.`, "success");
    onMudou();
  }

  return (
    <div className="space-y-2 border-t border-line p-4">
      {f.bloqueioPagar && <p className="text-xs text-muted">{f.bloqueioPagar}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {f.acaoPrincipal === "informar-valor" ? (
          <button
            type="button" onClick={onValor}
            className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600"
          >
            Informar valor real
          </button>
        ) : (
          <button
            type="button" onClick={onPagar} disabled={!f.podePagar}
            className="h-10 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Registrar pagamento
          </button>
        )}
        {f.podeAprovar && (
          <button
            type="button" onClick={aprovar} disabled={ocupado}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-ink hover:bg-subtle disabled:opacity-50"
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprovar
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Modal: registrar pagamento (§8) ───────────────────────────────────── */

function ModalPagar({
  f, onFechar, onPronto,
}: { f: FichaPagamento; onFechar: () => void; onPronto: () => void }) {
  const hoje = hojeSP();
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState(String((f.saldoCent / 100).toFixed(2)));
  const [conta, setConta] = useState(f.contas[0]?.id ?? "");
  const [juros, setJuros] = useState("");
  const [multa, setMulta] = useState("");
  const [quitar, setQuitar] = useState(true);
  const [justificativa, setJustificativa] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const emCent = (v: string) => Math.round((Number(v.replace(/\./g, "").replace(",", ".")) || 0) * 100);
  const pagoCent = emCent(valor);
  const previa = repartirPagamento({
    saldoCent: f.saldoCent, valorPagoCent: pagoCent, quitar,
    jurosInformadoCent: emCent(juros), multaInformadaCent: emCent(multa),
  });
  const menor = pagoCent > 0 && previa.principalCent < f.saldoCent;
  const dataInvalida = data > hoje;
  const faltaJustificativa = f.exigeNota && !f.temNota && !justificativa.trim();

  async function confirmar() {
    setOcupado(true);
    const e = await acao({
      action: "pagar", installmentId: f.id, date: data, valorCent: pagoCent,
      quitar, jurosCent: emCent(juros), multaCent: emCent(multa),
      accountId: conta || null, justificativaNota: justificativa.trim() || undefined,
    });
    setOcupado(false);
    if (e) { toast(e); return; }
    const nome = f.contas.find((c) => c.id === conta)?.nome;
    toast(
      `Pagamento registrado: ${f.fornecedor}, ${brlCheio(previa.principalCent)}.` +
        (nome ? ` Aguardando confirmação no extrato ${nome}.` : ""),
      "success",
    );
    onPronto();
  }

  return (
    <Modal titulo="Registrar pagamento" subtitulo={`${f.fornecedor}. Saldo de ${brlCheio(f.saldoCent)}.`} onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={input} />
        </Campo>
        <Campo rotulo="Valor pago">
          <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={input} />
        </Campo>
      </div>

      <Campo rotulo="Conta de saída">
        <select value={conta} onChange={(e) => setConta(e.target.value)} className={input}>
          {!f.contas.length && <option value="">Nenhuma conta cadastrada</option>}
          {f.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>

      {/* Encargos não são calculados: quem define juros e multa é o
          fornecedor, e inventar o número aqui seria pagar o valor errado. */}
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Juros pagos">
          <input type="text" inputMode="decimal" placeholder="0,00" value={juros} onChange={(e) => setJuros(e.target.value)} className={input} />
        </Campo>
        <Campo rotulo="Multa paga">
          <input type="text" inputMode="decimal" placeholder="0,00" value={multa} onChange={(e) => setMulta(e.target.value)} className={input} />
        </Campo>
      </div>

      {menor && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs text-ink">
            O valor é menor que o saldo. Faltam {brlCheio(f.saldoCent - previa.principalCent)}.
          </p>
          {[
            { v: false, t: `Manter ${brlCheio(f.saldoCent - previa.principalCent)} em aberto (pagamento parcial)` },
            { v: true, t: `Desconto obtido de ${brlCheio(f.saldoCent - previa.principalCent)} e quitar` },
          ].map((o) => (
            <label key={String(o.v)} className="flex items-start gap-2 text-xs text-ink">
              <input type="radio" checked={quitar === o.v} onChange={() => setQuitar(o.v)} className="mt-0.5" />
              {o.t}
            </label>
          ))}
          <p className="text-[11px] text-muted">
            O desconto vira receita financeira: a categoria original fica com o valor cheio.
          </p>
        </div>
      )}

      {f.exigeNota && !f.temNota && (
        <Campo rotulo="Esta categoria exige NF antes do pagamento. Justifique para seguir.">
          <input
            type="text" value={justificativa} onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Ex.: NF será enviada até sexta" className={input}
          />
        </Campo>
      )}

      {dataInvalida && <p className="text-xs text-rose-600">A data do pagamento não pode ser no futuro.</p>}

      <Botoes
        onFechar={onFechar}
        onConfirmar={confirmar}
        ocupado={ocupado}
        desabilitado={dataInvalida || pagoCent <= 0 || faltaJustificativa}
        label="Confirmar pagamento"
      />
    </Modal>
  );
}

/* ── Modal: informar valor real (§9) ───────────────────────────────────── */

function ModalValorReal({
  f, onFechar, onPronto,
}: { f: FichaPagamento; onFechar: () => void; onPronto: () => void }) {
  const [valor, setValor] = useState("");
  const [barcode, setBarcode] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const emCent = (v: string) => Math.round((Number(v.replace(/\./g, "").replace(",", ".")) || 0) * 100);
  const novoCent = emCent(valor);
  const estimadoCent = f.estimadoOriginalCent ?? f.valorCent;
  const dif = novoCent > 0 ? diferencaDoEstimado(estimadoCent, novoCent) : null;

  async function confirmar() {
    setOcupado(true);
    const e = await acao({
      action: "informar-valor", installmentId: f.id,
      novoValorCent: novoCent, barcode: barcode.trim() || undefined,
    });
    setOcupado(false);
    if (e) { toast(e); return; }
    toast(`Valor confirmado: ${f.fornecedor}, ${brlCheio(novoCent)}.`, "success");
    onPronto();
  }

  return (
    <Modal
      titulo="Informar valor real"
      subtitulo={`${f.fornecedor} · vence em ${f.vencimento}`}
      onFechar={onFechar}
    >
      <p className="rounded-xl bg-subtle px-3 py-2 text-xs text-muted">
        Estimado: {brlCheio(estimadoCent)}
      </p>
      <Campo rotulo="Valor da guia ou conta">
        <input type="text" inputMode="decimal" placeholder="0,00" value={valor} onChange={(e) => setValor(e.target.value)} className={input} autoFocus />
      </Campo>
      <Campo rotulo="Linha digitável ou código de barras">
        <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} className={input} />
      </Campo>

      {dif?.pct != null && (
        <p className={cn("text-xs", dif.revisar ? "text-amber-600" : "text-muted")}>
          Diferença de {dif.pct > 0 ? "+" : ""}{dif.pct}% em relação ao estimado.
          {dif.revisar && " Vale revisar o método de estimativa da recorrência."}
        </p>
      )}

      <Botoes
        onFechar={onFechar} onConfirmar={confirmar} ocupado={ocupado}
        desabilitado={novoCent <= 0} label="Confirmar valor"
      />
    </Modal>
  );
}

/* ── Peças dos modais ──────────────────────────────────────────────────── */

const input =
  "h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400";

function Modal({
  titulo, subtitulo, onFechar, children,
}: { titulo: string; subtitulo: string; onFechar: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-black/60" />
      <div role="dialog" aria-label={titulo} className="relative w-full max-w-lg space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-xl">
        <div>
          <h2 className="text-lg font-semibold text-ink">{titulo}</h2>
          <p className="text-xs text-muted">{subtitulo}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[11px] text-muted">
      {rotulo}
      {children}
    </label>
  );
}

function Botoes({
  onFechar, onConfirmar, ocupado, desabilitado, label,
}: {
  onFechar: () => void; onConfirmar: () => void;
  ocupado: boolean; desabilitado: boolean; label: string;
}) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button type="button" onClick={onFechar} className="h-10 rounded-xl border border-line px-4 text-sm text-ink hover:bg-subtle">
        Voltar
      </button>
      <button
        type="button" onClick={onConfirmar} disabled={ocupado || desabilitado}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    </div>
  );
}
