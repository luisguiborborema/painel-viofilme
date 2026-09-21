"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio, centavosDoTexto, hojeSP, valorEditavel } from "@/lib/data/dashboard-financeiro";
import type { CartaoConta, ItemDaFila } from "@/lib/data/caixa-server";

/**
 * As ações do Caixa: nova movimentação, transferência e o que a fila de
 * conciliação faz com cada item.
 *
 * Nenhuma delas é um `update` num campo. Uma movimentação nascida aqui cria
 * título, item, parcela e baixa nos bastidores, porque a DRE lê de itens de
 * título e nunca de movimentação solta (documento-mãe §13.4). A tela não
 * precisa saber disso — mas o texto de cada modal diz, porque quem lança uma
 * tarifa precisa entender por que ela aparece no resultado.
 */

export async function acaoDoCaixa(
  corpo: Record<string, unknown>,
): Promise<{ erro: string; dados: null } | { erro: null; dados: Record<string, unknown> }> {
  const res = await fetch("/api/gerencial/caixa", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  }).catch(() => null);
  const j = await res?.json().catch(() => null);
  if (!res?.ok) return { erro: j?.error ?? "Não foi possível concluir a ação.", dados: null };
  return { erro: null, dados: (j ?? {}) as Record<string, unknown> };
}

const input =
  "h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400";

/* ── Nova movimentação (§11.1) ─────────────────────────────────────────── */

export function ModalMovimentacao({
  contas, categorias, onFechar, onPronto,
}: {
  contas: CartaoConta[];
  categorias: { key: string; label: string }[];
  onFechar: () => void;
  onPronto: () => void;
}) {
  const hoje = hojeSP();
  const [conta, setConta] = useState(contas[0]?.id ?? "");
  const [tipo, setTipo] = useState<"entrada" | "saida">("saida");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const valorCent = centavosDoTexto(valor);
  const contaEscolhida = contas.find((c) => c.id === conta);

  async function salvar() {
    setOcupado(true);
    const { erro, dados } = await acaoDoCaixa({
      action: "movimentacao", contaId: conta, tipo, categoriaKey: categoria || undefined,
      descricao, data, valorCent,
    });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    toast(String(dados?.mensagem ?? "Movimentação registrada."), "success");
    onPronto();
  }

  return (
    <Modal
      titulo="Nova movimentação"
      subtitulo="Para o que não tem parcela: tarifa, rendimento, gasto pago na hora."
      onFechar={onFechar}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Conta">
          <select value={conta} onChange={(e) => setConta(e.target.value)} className={input}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as "entrada" | "saida")} className={input}>
            <option value="saida">Saída</option>
            <option value="entrada">Entrada</option>
          </select>
        </Campo>
      </div>

      <Campo rotulo="Categoria">
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={input}>
          <option value="">Sem categoria</option>
          {categorias.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </Campo>

      <Campo rotulo="Descrição">
        <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)}
          placeholder="Tarifa do pacote, rendimento da aplicação…" className={input} />
      </Campo>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={input} />
        </Campo>
        <Campo rotulo="Valor">
          <input type="text" inputMode="decimal" value={valor} placeholder="0,00"
            onChange={(e) => setValor(e.target.value)} className={input} />
        </Campo>
      </div>

      {/* Quem lança uma tarifa precisa entender por que ela aparece na DRE. */}
      <p className="text-[11px] leading-relaxed text-muted">
        O sistema cria o título já liquidado, para a movimentação aparecer no resultado pela
        categoria.
        {contaEscolhida?.usaExtrato &&
          " Como esta conta confirma por extrato, ela fica aguardando a linha do banco."}
      </p>

      <Botoes onFechar={onFechar} onConfirmar={salvar} ocupado={ocupado}
        desabilitado={!conta || valorCent <= 0} label="Lançar movimentação" />
    </Modal>
  );
}

/* ── Nova transferência (§11.2) ────────────────────────────────────────── */

export function ModalTransferencia({
  contas, onFechar, onPronto,
}: { contas: CartaoConta[]; onFechar: () => void; onPronto: () => void }) {
  const hoje = hojeSP();
  const [de, setDe] = useState(contas[0]?.id ?? "");
  const [para, setPara] = useState(contas[1]?.id ?? "");
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState("");
  const [tarifa, setTarifa] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const destino = contas.find((c) => c.id === para);
  const valorCent = centavosDoTexto(valor);

  // Cada destino muda o que a transferência significa no fluxo, e o texto
  // acompanha: o mesmo formulário faz uma aplicação e um pagamento de fatura.
  const nota = !destino ? ""
    : destino.tipo === "reserva"
      ? "Aplicação na reserva: sai do disponível e aparece em “Entre contas” no fluxo."
      : destino.tipo === "cartao"
        ? "Pagamento de fatura: é transferência, porque as compras já entraram como despesa."
        : "Entre contas do disponível: no fluxo consolidado ela não aparece, só no da conta.";

  async function salvar() {
    setOcupado(true);
    const { erro, dados } = await acaoDoCaixa({
      action: "transferencia", deContaId: de, paraContaId: para, data,
      valorCent, tarifaCent: centavosDoTexto(tarifa),
    });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    toast(String(dados?.mensagem ?? "Transferência registrada."), "success");
    onPronto();
  }

  return (
    <Modal titulo="Nova transferência" subtitulo="Dinheiro que muda de conta, sem virar receita nem despesa." onFechar={onFechar}>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="De">
          <select value={de} onChange={(e) => setDe(e.target.value)} className={input}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        <Campo rotulo="Para">
          <select value={para} onChange={(e) => setPara(e.target.value)} className={input}>
            {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Data">
          <input type="date" value={data} max={hoje} onChange={(e) => setData(e.target.value)} className={input} />
        </Campo>
        <Campo rotulo="Valor">
          <input type="text" inputMode="decimal" value={valor} placeholder="0,00"
            onChange={(e) => setValor(e.target.value)} className={input} />
        </Campo>
      </div>

      <Campo rotulo="Tarifa cobrada pelo banco (opcional)">
        <input type="text" inputMode="decimal" value={tarifa} placeholder="0,00"
          onChange={(e) => setTarifa(e.target.value)} className={input} />
      </Campo>

      {nota && <p className="text-[11px] leading-relaxed text-muted">{nota}</p>}
      {de === para && <p className="text-xs text-rose-600">As contas precisam ser diferentes.</p>}

      <Botoes onFechar={onFechar} onConfirmar={salvar} ocupado={ocupado}
        desabilitado={de === para || valorCent <= 0} label="Registrar transferência" />
    </Modal>
  );
}

/* ── Ações da fila de conciliação (§8.5 e §8.6) ────────────────────────── */

export function AcoesDaFila({
  item, categorias, onPronto,
}: {
  item: ItemDaFila;
  categorias: { key: string; label: string }[];
  onPronto: () => void;
}) {
  const [modo, setModo] = useState<"" | "ignorar" | "classificar">("");
  const [ocupado, setOcupado] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [categoria, setCategoria] = useState("");
  const [contraparte, setContraparte] = useState("");
  const [lembrar, setLembrar] = useState(true);
  const [quitar, setQuitar] = useState(false);

  async function executar(corpo: Record<string, unknown>) {
    setOcupado(true);
    const { erro, dados } = await acaoDoCaixa({ transactionId: item.id, ...corpo });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    toast(String(dados?.mensagem ?? "Pronto."), "success");
    onPronto();
  }

  const principal = () => {
    if (item.nivel === "classif" || item.nivel === "regra") return setModo("classificar");
    if (item.nivel === "transf") {
      toast("O par da transferência precisa do extrato da outra conta. Registre por “Nova transferência”.", "error");
      return;
    }
    if (!item.parcelas.length) return setModo("classificar");
    executar({
      action: "conciliar", parcelaIds: item.parcelas,
      encargosCent: item.encargosCent, quitar: item.nivel === "parcial" ? quitar : false,
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={principal} disabled={ocupado}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {item.acao}
        </button>
        <button type="button" onClick={() => setModo(modo === "classificar" ? "" : "classificar")}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink hover:border-brand-300">
          Classificar
        </button>
        <button type="button" onClick={() => setModo(modo === "ignorar" ? "" : "ignorar")}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink hover:border-brand-300">
          Ignorar
        </button>
      </div>

      {/* Pagamento parcial é escolha, não dedução: manter o saldo em aberto e
          dar desconto são decisões diferentes sobre o mesmo dinheiro. */}
      {item.nivel === "parcial" && (
        <label className="flex items-center gap-2 text-[11px] text-ink">
          <input type="checkbox" checked={quitar} onChange={(e) => setQuitar(e.target.checked)} />
          Dar desconto da diferença e quitar a parcela
        </label>
      )}

      {modo === "classificar" && (
        <div className="grid items-end gap-2 rounded-lg border border-line bg-subtle p-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <Campo rotulo="Categoria">
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={cn(input, "h-9")}>
              <option value="">Escolha</option>
              {categorias.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Cliente ou contraparte">
            <input type="text" value={contraparte} onChange={(e) => setContraparte(e.target.value)}
              className={cn(input, "h-9")} />
          </Campo>
          <span className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-[11px] text-ink">
              <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
              Lembrar para as próximas
            </label>
            <button type="button" disabled={ocupado || !categoria}
              onClick={() => executar({ action: "classificar", categoriaKey: categoria, contraparte, lembrar })}
              className="h-9 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {/* O botão de cima já diz "Classificar e conciliar" e só abre este
                  formulário. Repetir o rótulo aqui deixa dois botões iguais na
                  mesma linha, e o que age não é o que parece. */}
              Confirmar classificação
            </button>
          </span>
        </div>
      )}

      {modo === "ignorar" && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-subtle p-3">
          <Campo rotulo="Motivo">
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className={cn(input, "h-9 w-72")}>
              <option value="">Escolha</option>
              <option value="Lançamento duplicado pelo banco">Lançamento duplicado pelo banco</option>
              <option value="Estorno do próprio banco, já pareado">Estorno do próprio banco, já pareado</option>
              <option value="Teste ou valor simbólico">Teste ou valor simbólico</option>
              <option value="Outro">Outro</option>
            </select>
          </Campo>
          <button type="button" disabled={ocupado || !motivo}
            onClick={() => executar({ action: "ignorar", motivo })}
            className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink hover:border-brand-300 disabled:opacity-50">
            Ignorar movimentação
          </button>
          <p className="w-full text-[11px] text-muted">
            Movimentação ignorada sai do saldo. O motivo fica na auditoria, e ela pode voltar.
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────── */

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
      <div role="dialog" aria-label={titulo}
        className="relative w-full max-w-lg space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-xl">
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
      <button type="button" onClick={onFechar}
        className="h-10 rounded-xl border border-line px-4 text-sm text-ink hover:bg-subtle">
        Voltar
      </button>
      <button type="button" onClick={onConfirmar} disabled={ocupado || desabilitado}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
        {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
        {label}
      </button>
    </div>
  );
}

export const CLASSE_INPUT = input;
export const formatarValor = valorEditavel;

/* ── Importar extrato (§7) ─────────────────────────────────────────────── */

type Previa = {
  arquivo: string;
  periodoInicio: string | null;
  periodoFim: string | null;
  total: number;
  novas: number;
  existentes: number;
  confirmam: number;
  conta: string;
  conferencia: { confere: boolean; texto: string } | null;
  linhas: { dataIso: string; valorCent: number; descricaoRaw: string; situacao: string }[];
};

/**
 * Três passos, e a regra que os justifica: **nada é gravado sem a pessoa ver
 * antes o que vai acontecer**. A prévia diz quantas linhas são novas, quantas
 * já existem e quantas apenas confirmam uma baixa — importar às cegas é como
 * a mesma semana entra duas vezes e o saldo dobra sem erro nenhum na tela.
 */
export function ModalImportar({
  contas, onFechar, onPronto,
}: { contas: CartaoConta[]; onFechar: () => void; onPronto: () => void }) {
  const comExtrato = contas.filter((c) => c.usaExtrato);
  const [conta, setConta] = useState(comExtrato[0]?.id ?? contas[0]?.id ?? "");
  const [arquivo, setArquivo] = useState<{ nome: string; conteudo: string; formato: "ofx" | "csv" } | null>(null);
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const passo = previa ? 2 : 1;

  async function escolher(f: File) {
    const conteudo = await f.text();
    setArquivo({
      nome: f.name,
      conteudo,
      formato: /\.ofx$/i.test(f.name) || /<STMTTRN>/i.test(conteudo) ? "ofx" : "csv",
    });
    setPrevia(null);
  }

  async function analisar() {
    if (!arquivo) return;
    setOcupado(true);
    const res = await fetch("/api/gerencial/caixa/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        etapa: "previa", contaId: conta, nomeArquivo: arquivo.nome,
        conteudo: arquivo.conteudo, formato: arquivo.formato,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setOcupado(false);
    if (!res?.ok) { toast(j?.error ?? "Não foi possível ler o arquivo."); return; }
    setPrevia(j.previa as Previa);
  }

  async function importar() {
    if (!arquivo) return;
    setOcupado(true);
    const res = await fetch("/api/gerencial/caixa/importar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        etapa: "confirmar", contaId: conta, nomeArquivo: arquivo.nome,
        conteudo: arquivo.conteudo, formato: arquivo.formato,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setOcupado(false);
    if (!res?.ok) { toast(j?.error ?? "Não foi possível importar."); return; }
    toast(String(j?.mensagem ?? "Extrato importado."), "success");
    onPronto();
  }

  return (
    <Modal titulo="Importar extrato" subtitulo={`Passo ${passo} de 2`} onFechar={onFechar}>
      {passo === 1 ? (
        <>
          <Campo rotulo="Conta">
            <select value={conta} onChange={(e) => setConta(e.target.value)} className={input}>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}{c.usaExtrato ? "" : " (não usa extrato)"}
                </option>
              ))}
            </select>
          </Campo>

          <label className={cn(
            "flex h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-center",
            arquivo ? "border-brand-500 bg-brand-500/5" : "border-line hover:border-brand-300",
          )}>
            <input type="file" accept=".ofx,.csv,.txt" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) escolher(f); }} />
            <span className="text-sm font-semibold text-ink">
              {arquivo ? `Arquivo: ${arquivo.nome}` : "Escolher o arquivo do banco"}
            </span>
            <span className="text-[11px] text-muted">
              OFX ou CSV. Nada é gravado antes de você ver a prévia.
            </span>
          </label>

          <Botoes onFechar={onFechar} onConfirmar={analisar} ocupado={ocupado}
            desabilitado={!arquivo || !conta} label="Ler arquivo" />
        </>
      ) : (
        <>
          <p className="text-xs text-muted">
            {previa!.arquivo}
            {previa!.periodoInicio && `, de ${br(previa!.periodoInicio)} a ${br(previa!.periodoFim!)}`}
          </p>

          <div className="grid grid-cols-4 gap-2">
            <Numero label="No arquivo" valor={previa!.total} />
            <Numero label="Novas" valor={previa!.novas} tom="ok" />
            <Numero label="Já existentes" valor={previa!.existentes} />
            <Numero label="Confirmam baixas" valor={previa!.confirmam} />
          </div>

          {previa!.conferencia && (
            <p className={cn("rounded-xl border p-3 text-xs leading-relaxed",
              previa!.conferencia.confere
                ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-600"
                : "border-rose-500/40 bg-rose-500/5 text-rose-600")}>
              {previa!.conferencia.texto}
            </p>
          )}

          <div className="max-h-48 space-y-1 overflow-y-auto">
            {previa!.linhas.map((l, n) => (
              <div key={n} className={cn(
                "grid grid-cols-[52px_minmax(0,1fr)_90px_90px] gap-2 rounded-lg bg-subtle px-2.5 py-1.5 text-[11px]",
                l.situacao === "existente" && "opacity-50",
              )}>
                <span className="text-muted">{l.dataIso.slice(8, 10)}/{l.dataIso.slice(5, 7)}</span>
                <span className="truncate font-mono text-[10px]">{l.descricaoRaw}</span>
                <span className="text-right font-semibold">{brlCheio(l.valorCent)}</span>
                <span className={cn(
                  l.situacao === "nova" ? "text-emerald-600"
                    : l.situacao === "confirma" ? "text-sky-600" : "text-muted",
                )}>
                  {l.situacao === "nova" ? "nova" : l.situacao === "confirma" ? "confirma baixa" : "já existe"}
                </span>
              </div>
            ))}
          </div>

          <Botoes onFechar={() => setPrevia(null)} onConfirmar={importar} ocupado={ocupado}
            desabilitado={previa!.novas === 0 && previa!.confirmam === 0}
            label={`Importar ${previa!.novas} ${previa!.novas === 1 ? "movimentação" : "movimentações"}`} />
        </>
      )}
    </Modal>
  );
}

function Numero({ label, valor, tom }: { label: string; valor: number; tom?: "ok" }) {
  return (
    <span className="flex flex-col gap-0.5 rounded-xl bg-subtle p-3">
      <span className="text-[11px] text-muted">{label}</span>
      <span className={cn("text-lg font-semibold", tom === "ok" ? "text-emerald-600" : "text-ink")}>
        {valor}
      </span>
    </span>
  );
}

const br = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
