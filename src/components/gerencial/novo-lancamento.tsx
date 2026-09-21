"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { brlCheio, centavosDoTexto, hojeSP } from "@/lib/data/dashboard-financeiro";
import { dividirParcelas, vencimentoDaParcela } from "@/lib/data/recebimentos";
import { repartir } from "@/lib/data/pagamentos";

/**
 * Nova despesa (Pagamentos §10) e nova receita (Recebimentos §7).
 *
 * As duas specs descrevem o MESMO esqueleto — formulário à esquerda, prévia
 * viva à direita —, então é um componente só, parametrizado pela direção.
 *
 * A prévia não é enfeite: é ela que torna seguro um formulário que cria três,
 * seis ou doze parcelas de uma vez. Quem confere antes de salvar não descobre
 * depois que o carnê saiu com o vencimento errado.
 */

export type Contraparte = { id: string; nome: string };
export type Categoria = { key: string; label: string };
export type ContaOpcao = { id: string; nome: string };

type Item = { id: number; categoria: string; valor: string };

const input =
  "h-10 w-full rounded-xl border border-line bg-canvas px-3 text-sm text-ink outline-none focus:border-brand-400";

const TIPOS = [
  { key: "unica", label: "Única", sub: "Um vencimento" },
  { key: "parcelada", label: "Parcelada", sub: "Em parcelas" },
  { key: "recorrente", label: "Recorrente", sub: "Todo mês" },
] as const;

export function NovoLancamento({
  direcao, contrapartes, categorias, contas, onFechar, onPronto,
}: {
  direcao: "in" | "out";
  contrapartes: Contraparte[];
  categorias: Categoria[];
  contas: ContaOpcao[];
  onFechar: () => void;
  onPronto: () => void;
}) {
  const hoje = hojeSP();
  const receita = direcao === "in";

  const [tipo, setTipo] = useState<"unica" | "parcelada" | "recorrente">("unica");
  const [contraparte, setContraparte] = useState("");
  const [descricao, setDescricao] = useState("");
  const [itens, setItens] = useState<Item[]>([{ id: 1, categoria: "", valor: "" }]);
  const [vencimento, setVencimento] = useState(hoje);
  const [parcelas, setParcelas] = useState("3");
  const [intervalo, setIntervalo] = useState<"mensal" | "quinzenal">("mensal");
  const [diaVencimento, setDiaVencimento] = useState("5");
  const [fim, setFim] = useState("");
  const [conta, setConta] = useState("");
  const [competenciaUnica, setCompetenciaUnica] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onFechar]);

  const totalCent = itens.reduce((s, i) => s + centavosDoTexto(i.valor), 0);
  const n = tipo === "parcelada" ? Math.min(60, Math.max(1, Number(parcelas) || 1)) : 1;

  // A prévia usa as MESMAS funções que a rota usa para gravar. Se usasse uma
  // conta própria, ela poderia mostrar um carnê diferente do que seria salvo.
  const previa = (() => {
    if (totalCent <= 0) return [];
    if (tipo === "recorrente") {
      const dia = Math.min(28, Math.max(1, Number(diaVencimento) || 5));
      const base = `${hoje.slice(0, 8)}${String(dia).padStart(2, "0")}`;
      const primeiro = base >= hoje ? base : vencimentoDaParcela(base, 1);
      return [0, 1, 2]
        .map((i) => vencimentoDaParcela(primeiro, i))
        .filter((d) => !fim || d <= fim)
        .map((d, i) => ({ numero: i + 1, venc: d, valorCent: totalCent }));
    }
    const valores = receita ? dividirParcelas(totalCent, n) : repartir(totalCent, n);
    return Array.from({ length: n }, (_, i) => ({
      numero: i + 1,
      venc: n === 1 ? vencimento : vencimentoDaParcela(vencimento, i, intervalo === "mensal"),
      valorCent: valores[i],
    }));
  })();

  const pendencias = [
    !contraparte && (receita ? "o cliente" : "o fornecedor"),
    totalCent <= 0 && "ao menos um item com valor",
    tipo !== "recorrente" && !vencimento && "o vencimento",
  ].filter(Boolean) as string[];

  async function salvar() {
    setOcupado(true);
    const res = await fetch("/api/gerencial/lancamentos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        direcao, tipo,
        partyId: contraparte || null,
        descricao,
        itens: itens.map((i) => ({ categoriaKey: i.categoria || null, valorCent: centavosDoTexto(i.valor) })),
        vencimento, parcelas: n, intervalo,
        diaVencimento: Number(diaVencimento) || 5,
        inicio: hoje, fim: fim || null,
        contaId: conta || null,
        competenciaUnica,
      }),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setOcupado(false);
    if (!res?.ok) { toast(j?.error ?? "Não foi possível salvar."); return; }
    toast(String(j?.mensagem ?? "Lançamento criado."), "success");
    onPronto();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onFechar} className="absolute inset-0 bg-black/50" />
      <aside
        aria-label={receita ? "Nova receita" : "Nova despesa"}
        className="relative flex h-full w-full max-w-[940px] flex-col border-l border-line bg-surface"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{receita ? "Nova receita" : "Nova despesa"}</h2>
            <p className="text-xs text-muted">
              {receita
                ? "O compromisso do cliente com a agência. A baixa vem depois, quando o dinheiro entrar."
                : "O compromisso da agência. A baixa vem depois, quando o dinheiro sair."}
            </p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onFechar}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <div className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTipo(t.key)}
                  aria-pressed={tipo === t.key}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-colors",
                    tipo === t.key ? "border-brand-500 bg-brand-500/5" : "border-line hover:border-brand-300",
                  )}
                >
                  <span className="text-sm font-semibold text-ink">{t.label}</span>
                  <span className="text-[11px] text-muted">{t.sub}</span>
                </button>
              ))}
            </div>

            <Campo rotulo={receita ? "Cliente" : "Fornecedor"}>
              <select value={contraparte} onChange={(e) => setContraparte(e.target.value)} className={input}>
                <option value="">Escolha</option>
                {contrapartes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>

            <Campo rotulo="Descrição">
              <input type="text" value={descricao} onChange={(e) => setDescricao(e.target.value)}
                placeholder={receita ? "Mensalidade, projeto…" : "Aluguel, software, freelancer…"}
                className={input} />
            </Campo>

            <section className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Itens</p>
              {itens.map((it) => (
                <div key={it.id} className="grid items-end gap-2 lg:grid-cols-[minmax(0,1fr)_150px_40px]">
                  <Campo rotulo="Categoria">
                    <select value={it.categoria} className={input}
                      onChange={(e) => setItens((v) => v.map((x) => x.id === it.id ? { ...x, categoria: e.target.value } : x))}>
                      <option value="">Sem categoria</option>
                      {categorias.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </Campo>
                  <Campo rotulo="Valor">
                    <input type="text" inputMode="decimal" value={it.valor} placeholder="0,00" className={input}
                      onChange={(e) => setItens((v) => v.map((x) => x.id === it.id ? { ...x, valor: e.target.value } : x))} />
                  </Campo>
                  <button type="button" aria-label="Remover item"
                    onClick={() => setItens((v) => v.length > 1 ? v.filter((x) => x.id !== it.id) : v)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl border border-line text-muted hover:text-rose-600">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button type="button"
                onClick={() => setItens((v) => [...v, { id: Date.now(), categoria: "", valor: "" }])}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-xs text-ink hover:border-brand-300">
                <Plus className="h-3.5 w-3.5" />
                Adicionar item
              </button>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Condições</p>

              {tipo !== "recorrente" ? (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo rotulo={tipo === "parcelada" ? "1º vencimento" : "Vencimento"}>
                    <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={input} />
                  </Campo>
                  {tipo === "parcelada" && (
                    <>
                      <Campo rotulo="Parcelas">
                        <input type="number" min={2} max={60} value={parcelas}
                          onChange={(e) => setParcelas(e.target.value)} className={input} />
                      </Campo>
                      <Campo rotulo="Intervalo">
                        <select value={intervalo} className={input}
                          onChange={(e) => setIntervalo(e.target.value as "mensal" | "quinzenal")}>
                          <option value="mensal">Mensal</option>
                          <option value="quinzenal">Quinzenal</option>
                        </select>
                      </Campo>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-3">
                  <Campo rotulo="Dia do vencimento">
                    <input type="number" min={1} max={28} value={diaVencimento}
                      onChange={(e) => setDiaVencimento(e.target.value)} className={input} />
                  </Campo>
                  <Campo rotulo="Término (opcional)">
                    <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} className={input} />
                  </Campo>
                </div>
              )}

              {tipo === "parcelada" && (
                <label className="flex items-center gap-2 text-xs text-ink">
                  <input type="checkbox" checked={competenciaUnica}
                    onChange={(e) => setCompetenciaUnica(e.target.checked)} />
                  Competência toda no mês da 1ª parcela (entrega única)
                </label>
              )}

              <Campo rotulo={receita ? "Conta prevista de entrada" : "Conta prevista de saída"}>
                <select value={conta} onChange={(e) => setConta(e.target.value)} className={input}>
                  <option value="">Conta padrão</option>
                  {contas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </Campo>
            </section>
          </div>

          {/* ── Prévia viva ─────────────────────────────────────────────── */}
          <aside className="w-[330px] shrink-0 space-y-4 overflow-y-auto border-l border-line bg-subtle px-5 py-5">
            <div>
              <p className="text-sm font-semibold text-ink">
                {tipo === "recorrente"
                  ? `Recorrência de ${brlCheio(totalCent)} por mês`
                  : previa.length > 1
                    ? `${previa.length} parcelas`
                    : receita ? "Uma conta a receber" : "Uma conta a pagar"}
              </p>
              <p className="text-xs text-muted">
                {totalCent > 0 ? `Total de ${brlCheio(totalCent)}` : "Sem valor ainda"}
              </p>
            </div>

            {previa.length > 0 && (
              <ul className="m-0 list-none space-y-1.5 p-0">
                {previa.slice(0, 5).map((p) => (
                  <li key={p.numero}
                    className={cn(
                      "flex items-baseline justify-between gap-2 rounded-lg border px-3 py-2 text-xs",
                      tipo === "recorrente" && p.numero > 1
                        ? "border-dashed border-line text-muted"
                        : "border-line text-ink",
                    )}
                  >
                    <span>{previa.length > 1 ? `${p.numero}ª · ` : ""}{p.venc.split("-").reverse().join("/")}</span>
                    <span className="font-semibold">{brlCheio(p.valorCent)}</span>
                  </li>
                ))}
                {previa.length > 5 && (
                  <li className="px-3 text-[11px] text-muted">
                    e mais {previa.length - 5} {previa.length - 5 === 1 ? "parcela" : "parcelas"}
                  </li>
                )}
                {tipo === "recorrente" && (
                  <li className="px-3 text-[11px] text-muted">
                    E segue todo mês{fim ? ` até ${fim.split("-").reverse().join("/")}` : ""}. As três
                    primeiras já entram como parcela; o resto é gerado mês a mês.
                  </li>
                )}
              </ul>
            )}

            {/* Botão desabilitado sem dizer por quê é o que faz a pessoa
                clicar de novo achando que travou. */}
            {pendencias.length > 0 && (
              <div className="space-y-1 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <p className="text-[11px] font-semibold text-amber-600">Para salvar, falta:</p>
                {pendencias.map((p) => (
                  <p key={p} className="text-[11px] text-muted">{p}</p>
                ))}
              </div>
            )}
          </aside>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" onClick={onFechar}
            className="h-10 rounded-xl border border-line px-4 text-sm text-ink hover:bg-subtle">
            Cancelar
          </button>
          <button type="button" onClick={salvar} disabled={ocupado || pendencias.length > 0}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-500 px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
            Salvar
          </button>
        </footer>
      </aside>
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
