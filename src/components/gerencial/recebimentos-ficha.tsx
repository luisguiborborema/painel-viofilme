"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Loader2, Maximize2, Minimize2, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { centavosDoTexto, hojeSP, valorEditavel } from "@/lib/data/dashboard-financeiro";
import { repartirPagamento } from "@/lib/data/pagamentos";
import { brlExato, MOTIVOS_DISPENSA } from "@/lib/data/recebimentos";
import type { FichaRecebimento } from "@/app/api/gerencial/recebimentos/ficha/route";

/**
 * Ficha da conta a receber (spec §5) e o modal que opera sobre ela:
 * registrar recebimento (§6).
 *
 * Nenhuma decisão de permissão é tomada aqui: o servidor devolve
 * `podeReceber` e `bloqueioReceber` já resolvidos, e a tela obedece — e
 * continua obedecendo quando a regra mudar.
 */

const TOM: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-600",
  ruim: "bg-rose-500/15 text-rose-600",
  atencao: "bg-amber-500/15 text-amber-600",
  info: "bg-sky-500/15 text-sky-600",
  neutro: "bg-subtle text-muted",
};
const TOM_TEXTO: Record<string, string> = {
  ok: "text-emerald-600", ruim: "text-rose-600",
  atencao: "text-amber-600", info: "text-sky-600", neutro: "text-muted",
};

export async function acaoRecebimento(body: Record<string, unknown>): Promise<
  { erro: string; dados: null } | { erro: null; dados: Record<string, unknown> }
> {
  const res = await fetch("/api/gerencial/recebimentos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => null);
  const j = await res?.json().catch(() => null);
  if (!res?.ok) return { erro: j?.error ?? "Não foi possível concluir a ação.", dados: null };
  return { erro: null, dados: (j ?? {}) as Record<string, unknown> };
}

export function RecebimentosFicha({
  id, onFechar, onMudou, autoReceber = false,
}: {
  id: string;
  onFechar: () => void;
  onMudou: () => void;
  /** A ação "Registrar" da linha abre a ficha já com o modal aberto (§4.6). */
  autoReceber?: boolean;
}) {
  const [f, setF] = useState<FichaRecebimento | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [cheia, setCheia] = useState(false);

  useEffect(() => {
    let vivo = true;
    fetch(`/api/gerencial/recebimentos/ficha?id=${encodeURIComponent(id)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!vivo) return;
        if (!r.ok) { setErro(j?.error ?? "Não foi possível abrir a ficha."); return; }
        const ficha = j as FichaRecebimento;
        setF(ficha);
        // O modal só abre com a ficha em mãos: ele vive dos encargos
        // sugeridos e das contas, que vêm nesta mesma resposta.
        if (autoReceber && ficha.podeReceber) setModal(true);
      })
      .catch(() => vivo && setErro("Não foi possível abrir a ficha."));
    return () => { vivo = false; };
  }, [id, autoReceber]);

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
          aria-label="Ficha da conta a receber"
          className={cn(
            "relative flex h-full w-full flex-col border-l border-line bg-surface",
            cheia ? "max-w-none" : "max-w-[620px]",
          )}
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
              <Cabecalho
                f={f} onFechar={onFechar} cheia={cheia}
                onExpandir={() => setCheia((v) => !v)}
              />
              <Corpo f={f} />
              <Rodape f={f} onReceber={() => setModal(true)} />
            </>
          )}
        </aside>
      </div>

      {f && modal && <ModalReceber f={f} onFechar={() => setModal(false)} onPronto={pronto} />}
    </>
  );
}

/* ── Cabeçalho (§5.1) ──────────────────────────────────────────────────── */

function Cabecalho({
  f, onFechar, cheia, onExpandir,
}: { f: FichaRecebimento; onFechar: () => void; cheia: boolean; onExpandir: () => void }) {
  return (
    <header className="space-y-3 border-b border-line px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs text-muted">Conta a receber</span>
        <span className="flex gap-1">
          <button type="button" aria-label={cheia ? "Reduzir" : "Expandir"} onClick={onExpandir}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
            {cheia ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button type="button" aria-label="Fechar" onClick={onFechar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </span>
      </div>

      <div>
        <p className={cn("text-sm font-semibold", f.clienteVinculado ? "text-ink" : "text-muted")}>
          {f.cliente}
        </p>
        <p className="text-sm text-muted">{f.descricao}</p>
      </div>

      <div>
        <p className="text-2xl font-semibold tracking-tight text-ink">
          {brlExato(f.recebida ? f.valorCent : f.saldoCent)}
        </p>
        {f.subSaldo && (
          <p className={cn("text-xs", f.encargosCent > 0 ? "text-amber-600" : "text-muted")}>{f.subSaldo}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM[f.situacaoTom])}>
          {f.situacaoLabel}
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", TOM[f.cobranca.tom])}>
          {f.cobranca.texto}
        </span>
      </div>

      <p className="text-[11px] text-muted">{f.origem}</p>
    </header>
  );
}

/* ── Corpo (§5.2) ──────────────────────────────────────────────────────── */

function Corpo({ f }: { f: FichaRecebimento }) {
  return (
    <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
      <Secao titulo="Resumo">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
          <Dado rotulo="Vencimento" valor={f.vencimento} />
          <Dado rotulo="Competência" valor={f.competencia} />
          <Dado rotulo="Conta prevista" valor={f.contaPrevista ?? "Não definida"} />
          <Dado rotulo="Forma de cobrança" valor={f.formaCobranca} />
          <Dado rotulo="Nota fiscal" valor={f.nf ?? "Pendente"} tom={f.nf ? "neutro" : "atencao"} />
          <Dado rotulo="Parcela" valor={f.parcela} />
        </dl>
        {f.parcelas.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {f.parcelas.map((p) => (
              <span
                key={p.id}
                title={p.label}
                className={cn(
                  "h-2.5 w-2.5 rounded-full border",
                  p.paga ? "border-emerald-500 bg-emerald-500"
                    : p.atual ? "border-brand-500" : "border-line",
                )}
              />
            ))}
            <span className="text-[11px] text-muted">{f.parcela}</span>
          </div>
        )}
      </Secao>

      <Secao titulo="Itens">
        {f.itens.length ? (
          <ul className="m-0 list-none space-y-2 p-0">
            {f.itens.map((i, n) => (
              <li key={n} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-ink">{i.descricao}</span>
                  <span className="block truncate text-[11px] text-muted">{i.dimensoes}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink">{i.valor}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">Sem itens cadastrados neste título.</p>
        )}
      </Secao>

      <Secao titulo="Cobrança">
        <div className="flex gap-1.5">
          {f.etapas.map((e) => (
            <span key={e.nome} className="flex flex-1 flex-col gap-1">
              <span className={cn("h-1 rounded-full", e.concluida ? "bg-emerald-500" : "bg-subtle-strong")} />
              <span className="text-[11px] text-ink">{e.nome}</span>
              <span className="text-[11px] text-muted">{e.data ?? "—"}</span>
            </span>
          ))}
        </div>
        {f.linkPagamento && <LinkDePagamento url={f.linkPagamento} />}
        <p className="text-xs text-muted">{f.fraseDaRegua}</p>
        {f.destinatarios && <p className="text-[11px] text-muted">{f.destinatarios}</p>}
      </Secao>

      <Secao titulo="Recebimentos">
        {f.baixas.length ? (
          <ul className="m-0 list-none space-y-2 p-0">
            {f.baixas.map((b, n) => (
              <li key={n} className="flex items-start justify-between gap-3 rounded-lg border border-line px-3 py-2">
                <span className="min-w-0">
                  <span className="block text-sm text-ink">{b.data}{b.conta ? ` · ${b.conta}` : ""}</span>
                  {b.encargos && <span className="block text-[11px] text-muted">{b.encargos}</span>}
                  <span className={cn("block text-[11px]", b.conciliada ? "text-emerald-600" : "text-muted")}>
                    {b.conciliacao}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink">{b.valor}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted">Nenhum recebimento registrado.</p>
        )}
      </Secao>

      <Secao titulo="Anexos">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {f.anexos.map((a) => (
            <li key={a.kind}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px]",
                a.anexado ? "border-emerald-500/40 text-emerald-600" : "border-line text-muted",
              )}
            >
              {a.anexado && <Check className="h-3 w-3" />}
              {a.rotulo}{a.anexado ? "" : " — não anexado"}
            </li>
          ))}
        </ul>
        {/* Anexar exige upload, que esta ficha ainda não tem. Dizer isso é
            melhor que uma área de arrastar que não guarda nada. */}
        <p className="text-[11px] text-muted">O envio de arquivos por aqui ainda não existe.</p>
      </Secao>

      <Secao titulo="Histórico">
        {f.historico.length ? (
          <ol className="m-0 list-none space-y-1.5 p-0">
            {f.historico.map((h, n) => (
              <li key={n} className="flex gap-2 text-xs">
                <span className="shrink-0 text-muted">{h.quando}</span>
                <span className="text-ink">{h.texto}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-muted">Sem histórico registrado.</p>
        )}
      </Secao>
    </div>
  );
}

function LinkDePagamento({ url }: { url: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line px-3 py-2">
      <span className="min-w-0 flex-1 truncate text-[11px] text-muted">{url}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(url);
          toast("Link de pagamento copiado.", "success");
        }}
        className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-line px-2 text-[11px] text-ink hover:bg-subtle"
      >
        <Copy className="h-3 w-3" />
        Copiar link
      </button>
    </div>
  );
}

/* ── Rodapé (§5.1) ─────────────────────────────────────────────────────── */

function Rodape({ f, onReceber }: { f: FichaRecebimento; onReceber: () => void }) {
  return (
    <div className="space-y-2 border-t border-line px-5 py-4">
      {f.bloqueioReceber && <p className="text-xs text-amber-600">{f.bloqueioReceber}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReceber}
          disabled={!f.podeReceber}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Registrar recebimento
        </button>
        <button
          type="button"
          onClick={() => toast("A emissão e o reenvio de cobrança saem desta ficha em breve.", "error")}
          className="h-10 rounded-xl border border-line px-4 text-sm text-ink hover:bg-subtle"
        >
          {f.cobranca.texto === "Sem cobrança" ? "Enviar cobrança" : "Reenviar cobrança"}
        </button>
      </div>
    </div>
  );
}

/* ── Modal: registrar recebimento (§6) ─────────────────────────────────── */

function ModalReceber({
  f, onFechar, onPronto,
}: { f: FichaRecebimento; onFechar: () => void; onPronto: () => void }) {
  const hoje = hojeSP();
  const vencida = f.sugestao.diasAtraso > 0 && f.sugestao.totalCent > 0;

  const [data, setData] = useState(hoje);
  const [dispensar, setDispensar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [conta, setConta] = useState(f.contaSugeridaId ?? f.contas[0]?.id ?? "");
  const [quitar, setQuitar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  // O valor já vem somado com os encargos sugeridos (§6.1); ligar a dispensa
  // recalcula, que é justamente o efeito que a chave promete.
  const [valor, setValor] = useState(
    valorEditavel(vencida ? f.sugestao.valorSugeridoCent : f.saldoCent),
  );

  function alternarDispensa(ligado: boolean) {
    setDispensar(ligado);
    if (!ligado) setMotivo("");
    setValor(valorEditavel(ligado ? f.saldoCent : f.sugestao.valorSugeridoCent));
  }

  const recebidoCent = centavosDoTexto(valor);
  const jurosCent = dispensar ? 0 : f.sugestao.jurosCent;
  const multaCent = dispensar ? 0 : f.sugestao.multaCent;

  const previa = repartirPagamento({
    saldoCent: f.saldoCent, valorPagoCent: recebidoCent, quitar,
    jurosInformadoCent: jurosCent, multaInformadaCent: multaCent,
  });
  const falta = f.saldoCent - previa.principalCent;
  const menor = recebidoCent > 0 && falta > 0;
  const dataInvalida = data > hoje;
  const faltaMotivo = dispensar && !motivo;

  async function confirmar() {
    setOcupado(true);
    const { erro, dados } = await acaoRecebimento({
      action: "receber", installmentId: f.id, date: data, valorCent: recebidoCent,
      quitar: menor ? quitar : false,
      jurosCent, multaCent, accountId: conta || null,
      dispensarEncargos: dispensar, motivoDispensa: motivo || undefined,
    });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    toast(String(dados?.mensagem ?? "Recebimento registrado."), "success");
    onPronto();
  }

  return (
    <Modal
      titulo="Registrar recebimento"
      subtitulo={`${f.cliente}. Saldo de ${brlExato(f.saldoCent)}.`}
      onFechar={onFechar}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={input} />
        </Campo>
        <Campo rotulo="Valor recebido">
          <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} className={input} />
        </Campo>
      </div>

      <Campo rotulo="Conta de entrada">
        <select value={conta} onChange={(e) => setConta(e.target.value)} className={input}>
          {!f.contas.length && <option value="">Nenhuma conta cadastrada</option>}
          {f.contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
      </Campo>

      {vencida && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-ink">
            Encargos por atraso ({f.sugestao.diasAtraso} {f.sugestao.diasAtraso === 1 ? "dia" : "dias"}):{" "}
            {brlExato(f.sugestao.totalCent)}
          </p>
          {f.sugestao.detalhe && <p className="text-[11px] text-muted">{f.sugestao.detalhe}</p>}
          <label className="flex items-center gap-2 text-xs text-ink">
            <input type="checkbox" checked={dispensar} onChange={(e) => alternarDispensa(e.target.checked)} />
            Dispensar encargos
          </label>
          {dispensar && (
            <Campo rotulo="Motivo da dispensa">
              <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={input}>
                <option value="">Escolha o motivo</option>
                {MOTIVOS_DISPENSA.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </Campo>
          )}
        </div>
      )}

      {menor && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3">
          <p className="text-xs text-ink">
            O valor é menor que o saldo. Faltam {brlExato(falta)}.
          </p>
          {[
            { v: false, t: `Manter ${brlExato(falta)} em aberto (pagamento parcial)` },
            { v: true, t: `Dar desconto de ${brlExato(falta)} e quitar` },
          ].map((o) => (
            <label key={String(o.v)} className="flex items-start gap-2 text-xs text-ink">
              <input type="radio" checked={quitar === o.v} onChange={() => setQuitar(o.v)} className="mt-0.5" />
              {o.t}
            </label>
          ))}
          {/* O principal fica cheio e o desconto vem ao lado: é o que mantém a
              receita da categoria e faz a parcela realmente fechar. */}
          <p className="text-[11px] text-muted">
            O desconto vira despesa financeira: a receita do serviço fica com o valor cheio.
          </p>
        </div>
      )}

      {f.cobranca.texto !== "Sem cobrança" && !f.recebida && (
        <p className="text-[11px] text-amber-600">
          {menor && !quitar
            ? "A cobrança no Asaas não é reemitida pelo saldo automaticamente: cancele ou reemita por lá."
            : "A cobrança no Asaas não é cancelada automaticamente: cancele por lá para o cliente não pagar duas vezes."}
        </p>
      )}

      {dataInvalida && <p className="text-xs text-rose-600">A data do recebimento não pode ser no futuro.</p>}

      <Botoes
        onFechar={onFechar}
        onConfirmar={confirmar}
        ocupado={ocupado}
        desabilitado={dataInvalida || recebidoCent <= 0 || faltaMotivo}
        label="Confirmar recebimento"
      />
    </Modal>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────── */

const input =
  "h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400";

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">{titulo}</h3>
      {children}
    </section>
  );
}

function Dado({ rotulo, valor, tom = "neutro" }: { rotulo: string; valor: string; tom?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-muted">{rotulo}</dt>
      <dd className={cn("text-sm", TOM_TEXTO[tom] ?? "text-ink", tom === "neutro" && "text-ink")}>{valor}</dd>
    </div>
  );
}

export function Modal({
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

export function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-[11px] text-muted">
      {rotulo}
      {children}
    </label>
  );
}

export function Botoes({
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

export const CLASSE_INPUT = input;
