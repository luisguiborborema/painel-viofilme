"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Loader2, Lock, TriangleAlert, Unlock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type {
  CategoriaConfig, ConfiguracoesView as Dados, ContaConfig, ParametroNumero,
} from "@/lib/data/configuracoes-financeiras-server";

/**
 * Configurações Financeiras — o lugar único dos parâmetros do módulo.
 *
 * Todas as specs apontam para cá, e o que se edita aqui muda o comportamento
 * das outras páginas: a reserva mínima decide quando o caixa vira alerta, o
 * tipo de impacto da categoria decide onde ela cai na DRE e no fluxo, e a
 * flag "compõe o disponível" decide se uma reserva conta como dinheiro em
 * caixa. Por isso cada campo diz o que ele afeta, e não só o nome.
 *
 * A escrita vai pelos endpoints que já existiam: eles têm validação, alçada e
 * auditoria, e um caminho novo herdaria nada disso.
 */

const input =
  "h-9 w-full rounded-lg border border-line bg-canvas px-2.5 text-sm text-ink outline-none focus:border-brand-400";

async function salvar(rota: string, corpo: Record<string, unknown>): Promise<string | null> {
  const res = await fetch(`/api/gerencial/${rota}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(corpo),
  }).catch(() => null);
  const j = await res?.json().catch(() => null);
  if (!res?.ok) return j?.error ?? "Não foi possível salvar.";
  return null;
}

export function ConfiguracoesFinanceiras({ dados }: { dados: Dados }) {
  const router = useRouter();
  const [, revalidar] = useTransition();
  const recarregar = () => revalidar(() => router.refresh());

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs text-muted">Financeiro</p>
        <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-ink">Configurações</h1>
        <p className="mt-1 text-sm text-muted">
          Os parâmetros que as outras páginas do Financeiro leem. Todos têm padrão: nada aqui
          precisa ser preenchido para o módulo funcionar.
        </p>
      </header>

      {dados.pendente ? (
        <Card className="flex flex-col gap-1 p-5">
          <p className="text-sm font-semibold text-ink">Falta rodar a migração.</p>
          <p className="text-xs text-muted">{dados.pendenteMotivo}</p>
        </Card>
      ) : dados.semDados ? (
        <Card className="flex flex-col gap-1 p-5">
          <p className="text-sm font-semibold text-ink">Sem conexão com o banco</p>
          <p className="text-xs text-muted">A página lê e grava dados reais.</p>
        </Card>
      ) : (
        <>
          {dados.grupos.map((g) => (
            <GrupoDeParametros key={g.titulo} grupo={g} onSalvou={recarregar} />
          ))}

          <Contas dados={dados} onSalvou={recarregar} />
          <Categorias dados={dados} onSalvou={recarregar} />
          <Regua dados={dados} />
          <Fechamento dados={dados} onSalvou={recarregar} />
        </>
      )}
    </div>
  );
}

/* ── Parâmetros numéricos ──────────────────────────────────────────────── */

function GrupoDeParametros({
  grupo, onSalvou,
}: { grupo: Dados["grupos"][number]; onSalvou: () => void }) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">{grupo.titulo}</h2>
        <p className="text-xs text-muted">{grupo.descricao}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {grupo.itens.map((p) => <Parametro key={p.key} p={p} onSalvou={onSalvou} />)}
      </div>
    </Card>
  );
}

function Parametro({ p, onSalvou }: { p: ParametroNumero; onSalvou: () => void }) {
  const [valor, setValor] = useState(String(p.valor));
  const [ocupado, setOcupado] = useState(false);
  const mudou = Number(valor) !== p.valor;

  async function gravar() {
    setOcupado(true);
    const erro = await salvar("finance-settings", { [p.key]: Number(valor) || 0 });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    toast(`${p.label} salvo.`, "success");
    onSalvou();
  }

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink">{p.label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number" value={valor} onChange={(e) => setValor(e.target.value)}
          onBlur={() => mudou && gravar()}
          className={input}
        />
        <span className="shrink-0 text-xs text-muted">{p.sufixo}</span>
        {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" />}
      </span>
      {p.explicacao && <span className="text-[11px] leading-relaxed text-muted">{p.explicacao}</span>}
      {/* O padrão dito em voz alta evita a pergunta "isso está configurado ou
          é o valor de fábrica?", que é a dúvida que trava quem chega depois. */}
      <span className="text-[10px] text-muted">
        Padrão {p.padrao}{p.sufixo === "%" || p.sufixo === "% ao mês" ? "%" : ""} · {p.origem}
      </span>
    </label>
  );
}

/* ── Contas financeiras ────────────────────────────────────────────────── */

function Contas({ dados, onSalvou }: { dados: Dados; onSalvou: () => void }) {
  const [novaAberta, setNovaAberta] = useState(false);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Contas financeiras</h2>
          <p className="text-xs text-muted">
            Onde o dinheiro está. O saldo nunca é digitado: é o saldo inicial mais as movimentações.
          </p>
        </div>
        <button type="button" onClick={() => setNovaAberta((v) => !v)}
          className="h-9 rounded-lg border border-line bg-surface px-3 text-xs font-medium text-ink hover:border-brand-300">
          {novaAberta ? "Cancelar" : "Nova conta"}
        </button>
      </div>

      {novaAberta && <NovaConta dados={dados} onPronto={() => { setNovaAberta(false); onSalvou(); }} />}

      <div className="hidden grid-cols-[minmax(0,1fr)_140px_130px_120px_120px] gap-3 border-y border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
        <span>Conta</span><span>Tipo</span><span className="text-right">Saldo inicial</span>
        <span>Compõe disponível</span><span>Confirma por extrato</span>
      </div>

      {dados.contas.map((c) => <LinhaDaConta key={c.id} c={c} dados={dados} onSalvou={onSalvou} />)}

      {!dados.contas.length && (
        <p className="px-5 py-8 text-center text-xs text-muted">
          Nenhuma conta cadastrada. Sem conta, o Caixa não tem saldo para mostrar.
        </p>
      )}
    </Card>
  );
}

function LinhaDaConta({
  c, dados, onSalvou,
}: { c: ContaConfig; dados: Dados; onSalvou: () => void }) {
  const [ocupado, setOcupado] = useState(false);

  async function alterar(campo: Record<string, unknown>) {
    setOcupado(true);
    const erro = await salvar("accounts", { action: "update", id: c.id, ...campo });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    onSalvou();
  }

  return (
    <div className="grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[minmax(0,1fr)_140px_130px_120px_120px]">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-ink">
          {c.nome}
          {c.padrao && <span className="ml-2 rounded bg-subtle-strong px-1.5 text-[10px] text-muted">padrão</span>}
          {!c.ativa && <span className="ml-2 text-[10px] text-muted">inativa</span>}
        </span>
        {c.instituicao && <span className="truncate text-[11px] text-muted">{c.instituicao}</span>}
      </span>

      <select value={c.tipo} onChange={(e) => alterar({ kind: e.target.value })} className={input}>
        {dados.opcoes.tipos.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </select>

      <span className="text-right text-sm tabular-nums text-ink">
        {c.saldoInicial.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </span>

      {/* Reserva marcada como disponível apareceria como dinheiro em caixa, e
          o fôlego da empresa sairia inflado. */}
      <Chave ligado={c.compoeDisponivel} ocupado={ocupado}
        onMudar={(v) => alterar({ countsAsAvailable: v })} />
      <Chave ligado={c.exigeExtrato} ocupado={ocupado}
        onMudar={(v) => alterar({ requiresStatementConfirmation: v })} />
    </div>
  );
}

function NovaConta({ dados, onPronto }: { dados: Dados; onPronto: () => void }) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("banco");
  const [saldo, setSaldo] = useState("0");
  const [ocupado, setOcupado] = useState(false);

  async function criar() {
    setOcupado(true);
    const erro = await salvar("accounts", {
      action: "create", name: nome, kind: tipo, openingBalance: Number(saldo) || 0,
      // Reserva e cartão nascem fora do disponível: uma é dinheiro que não se
      // pode gastar hoje, o outro é dívida.
      countsAsAvailable: !["reserva", "cartao"].includes(tipo),
      requiresStatementConfirmation: tipo === "banco" || tipo === "cartao",
    });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    toast("Conta criada.", "success");
    onPronto();
  }

  return (
    <div className="grid items-end gap-3 border-t border-line bg-subtle px-5 py-4 lg:grid-cols-[minmax(0,1fr)_160px_160px_auto]">
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Nome
        <input type="text" value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Inter, Asaas, Reserva…" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Tipo
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={input}>
          {dados.opcoes.tipos.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[11px] text-muted">
        Saldo inicial
        <input type="number" value={saldo} onChange={(e) => setSaldo(e.target.value)} className={input} />
      </label>
      <button type="button" onClick={criar} disabled={ocupado || !nome.trim()}
        className="h-9 rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
        Criar conta
      </button>
    </div>
  );
}

/* ── Categorias ────────────────────────────────────────────────────────── */

function Categorias({ dados, onSalvou }: { dados: Dados; onSalvou: () => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="text-sm font-semibold text-ink">Categorias</h2>
        <p className="text-xs text-muted">
          O <b>tipo de impacto</b> decide sozinho onde a categoria aparece: na DRE e em que bloco do
          fluxo de caixa. Investimento e movimento com sócios ficam fora da DRE — uma câmera não é
          prejuízo operacional.
        </p>
      </div>

      {dados.semImpacto > 0 && (
        <p className="flex items-center gap-2 border-y border-line bg-amber-500/5 px-5 py-2.5 text-xs text-amber-600">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
          {dados.semImpacto} {dados.semImpacto === 1 ? "categoria está" : "categorias estão"} sem tipo
          de impacto e {dados.semImpacto === 1 ? "fica" : "ficam"} fora da DRE.
        </p>
      )}

      <div className="hidden grid-cols-[minmax(0,1fr)_200px_180px_100px] gap-3 border-y border-line bg-subtle px-5 py-2.5 text-[11px] text-muted lg:grid">
        <span>Categoria</span><span>Tipo de impacto</span><span>Linha do fluxo de caixa</span>
        <span>Exige NF</span>
      </div>

      {dados.categorias.map((c) => (
        <LinhaDaCategoria key={c.id} c={c} dados={dados} onSalvou={onSalvou} />
      ))}

      {!dados.categorias.length && (
        <p className="px-5 py-8 text-center text-xs text-muted">Nenhuma categoria cadastrada.</p>
      )}
    </Card>
  );
}

function LinhaDaCategoria({
  c, dados, onSalvou,
}: { c: CategoriaConfig; dados: Dados; onSalvou: () => void }) {
  async function alterar(campo: Record<string, unknown>) {
    const erro = await salvar("expense-categories", { action: "update", id: c.id, ...campo });
    if (erro) { toast(erro); return; }
    onSalvou();
  }

  return (
    <div className="grid items-center gap-3 border-b border-line px-5 py-3 lg:grid-cols-[minmax(0,1fr)_200px_180px_100px]">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium text-ink">{c.label}</span>
        <span className="truncate font-mono text-[10px] text-muted">{c.key}</span>
      </span>

      <select
        value={c.impacto ?? ""}
        onChange={(e) => alterar({ impactType: e.target.value })}
        className={cn(input, !c.impacto && "border-amber-500/50")}
      >
        <option value="">Sem tipo definido</option>
        {dados.opcoes.impactos.map((i) => (
          <option key={i.key} value={i.key}>{i.label}</option>
        ))}
      </select>

      <select
        value={c.linhaFluxo ?? ""}
        onChange={(e) => {
          const linha = dados.opcoes.linhas.find((l) => l.key === e.target.value);
          // O bloco vai junto com a linha: escolher "Equipe e pró-labore" e
          // deixar o bloco em "Investimentos" produziria um fluxo incoerente.
          alterar({ cashFlowLine: e.target.value, cashFlowGroup: linha?.bloco });
        }}
        className={input}
      >
        <option value="">Derivado do tipo de impacto</option>
        {dados.opcoes.linhas.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
      </select>

      <Chave ligado={c.exigeNota} onMudar={(v) => alterar({ requiresInvoice: v })} />
    </div>
  );
}

/* ── Régua de cobrança ─────────────────────────────────────────────────── */

function Regua({ dados }: { dados: Dados }) {
  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Régua de cobrança</h2>
        <p className="text-xs text-muted">
          As etapas que a Inadimplência usa para dizer em que ponto cada cliente está.
        </p>
      </div>
      {dados.regua.length ? (
        <>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {dados.regua.map((e) => (
              <div key={e.dia} className="flex flex-col gap-0.5 rounded-xl border border-line p-3">
                <span className="text-xs font-semibold text-ink">{e.dia}</span>
                <span className="text-[11px] text-muted">{e.acao}</span>
                <span className="text-[11px] text-muted">{e.modo}{e.canal ? ` · ${e.canal}` : ""}</span>
              </div>
            ))}
          </div>
          {/* Prometer que a etapa dispara sozinha, sem job rodando, seria
              descrever um e-mail que ninguém envia. */}
          <p className="text-[11px] text-amber-600">
            As etapas automáticas ainda não disparam sozinhas: não existe job de cobrança rodando.
            A edição da régua também ainda não existe — por ora ela é a padrão da spec.
          </p>
        </>
      ) : (
        <p className="text-xs text-muted">
          Nenhuma régua cadastrada. Rode a migração 0150_recebimentos.sql.
        </p>
      )}
    </Card>
  );
}

/* ── Fechamento do período ─────────────────────────────────────────────── */

function Fechamento({ dados, onSalvou }: { dados: Dados; onSalvou: () => void }) {
  const [data, setData] = useState(dados.fechadoAte ?? "");
  const [ocupado, setOcupado] = useState(false);

  async function agir(action: "fechar" | "reabrir") {
    setOcupado(true);
    const erro = await salvar("finance-reports", {
      action, closedUntil: action === "fechar" ? data : null,
    });
    setOcupado(false);
    if (erro) { toast(erro); return; }
    toast(action === "fechar" ? `Período fechado até ${data}.` : "Período reaberto.", "success");
    onSalvou();
  }

  return (
    <Card className="space-y-3 p-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Fechamento do período</h2>
        <p className="text-xs text-muted">
          Tudo com vencimento até a data fica travado: alterar exige justificativa, e o Resultados
          passa a mostrar o selo &quot;fechado&quot;.
        </p>
      </div>

      <p className={cn("flex items-center gap-2 text-xs",
        dados.fechadoAte ? "text-emerald-600" : "text-muted")}>
        {dados.fechadoAte ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
        {dados.fechadoAte
          ? `Fechado até ${dados.fechadoAte.split("-").reverse().join("/")}`
          : "Nenhum período fechado. As páginas abrem no mês corrente, que está incompleto."}
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-[11px] text-muted">
          Fechar até
          <input type="date" value={data} onChange={(e) => setData(e.target.value)}
            className={cn(input, "w-44")} />
        </label>
        <button type="button" onClick={() => agir("fechar")} disabled={ocupado || !data}
          className="h-9 rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          Fechar período
        </button>
        {dados.fechadoAte && (
          <button type="button" onClick={() => agir("reabrir")} disabled={ocupado}
            className="h-9 rounded-lg border border-line bg-surface px-3 text-xs text-ink hover:border-brand-300">
            Reabrir
          </button>
        )}
      </div>
    </Card>
  );
}

/* ── Peças ─────────────────────────────────────────────────────────────── */

function Chave({
  ligado, onMudar, ocupado = false,
}: { ligado: boolean; onMudar: (v: boolean) => void; ocupado?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      disabled={ocupado}
      onClick={() => onMudar(!ligado)}
      className={cn(
        "flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors",
        ligado ? "bg-brand-500" : "bg-subtle-strong",
      )}
    >
      <span className={cn(
        "flex h-5 w-5 items-center justify-center rounded-full bg-white transition-transform",
        ligado && "translate-x-5",
      )}>
        {ligado && <Check className="h-3 w-3 text-brand-600" />}
      </span>
    </button>
  );
}
