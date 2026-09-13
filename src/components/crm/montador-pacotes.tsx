"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Check, Copy, Eye, FileText, Loader2, Plus, Send, Trash2, X,
} from "lucide-react";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import {
  CADENCIAS, avaliarMargem, fmtBRL, normalizarCadencia, rotuloDoPlano, totaisDoPacote,
  type Cadencia, type ItemPacote, type TotaisPacote,
} from "@/lib/data/catalogo";
import type { ServiceCatalog } from "@/lib/data/listas-server";

type Proposta = { id: string; token: string; status: string; viewedAt: string | null; signedAt: string | null };
type Pacote = {
  id: string;
  name: string;
  clientHint: string | null;
  notes: string | null;
  status: string;
  discount: number;
  itens: ItemPacote[];
  totais: TotaisPacote;
  proposta: Proposta | null;
};

const campo = "h-9 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-ink outline-none focus:border-brand-400";
const num = (v: string) => {
  const n = Number(String(v).replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

/** Rascunho local do pacote — o que o usuário edita antes de salvar. */
type Rascunho = {
  id: string | null;
  name: string;
  clientHint: string;
  notes: string;
  discount: number;
  itens: ItemPacote[];
};

const VAZIO: Rascunho = { id: null, name: "", clientHint: "", notes: "", discount: 0, itens: [] };

export function MontadorPacotes({ catalogo }: { catalogo: ServiceCatalog[] }) {
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [metaMargin, setMetaMargin] = useState(42);
  const [pendente, setPendente] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/gerencial/pacotes", { cache: "no-store" })
      .then((x) => x.json())
      .catch(() => null);
    setPacotes(r?.pacotes ?? []);
    if (r?.metaMargin != null) setMetaMargin(Number(r.metaMargin));
    setPendente(r?.pendente ?? null);
    setCarregando(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    carregar();
  }, [carregar]);

  async function api(body: unknown): Promise<{ ok: boolean; error?: string; caminho?: string }> {
    const res = await fetch("/api/gerencial/pacotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json().catch(() => null);
    return { ok: res.ok, error: j?.error, caminho: j?.caminho };
  }

  async function salvar() {
    if (!rascunho) return;
    if (!rascunho.name.trim()) { toast("Dê um nome ao pacote.", "error"); return; }
    setOcupado("salvar");
    const corpo = {
      action: rascunho.id ? "atualizar" : "criar",
      id: rascunho.id ?? undefined,
      name: rascunho.name,
      clientHint: rascunho.clientHint,
      notes: rascunho.notes,
      discount: rascunho.discount,
      itens: rascunho.itens,
    };
    const r = await api(corpo);
    setOcupado(null);
    if (!r.ok) { toast(r.error ?? "Falha ao salvar.", "error"); return; }
    toast("Pacote salvo.", "success");
    setRascunho(null);
    carregar();
  }

  async function excluir(id: string) {
    if (!confirm("Excluir este pacote?")) return;
    setOcupado(id);
    const r = await api({ action: "excluir", id });
    setOcupado(null);
    if (!r.ok) { toast(r.error ?? "Falha ao excluir.", "error"); return; }
    carregar();
  }

  async function gerarProposta(id: string) {
    setOcupado(id);
    const r = await api({ action: "gerar-proposta", id });
    setOcupado(null);
    if (!r.ok) { toast(r.error ?? "Falha ao gerar.", "error"); return; }
    // Origem do navegador em vez do env: o link copiado precisa ser o domínio
    // por onde a pessoa entrou, não o que alguém configurou meses atrás.
    if (r.caminho) await navigator.clipboard?.writeText(`${window.location.origin}${r.caminho}`).catch(() => {});
    toast("Proposta gerada — link copiado.", "success");
    carregar();
  }

  if (pendente) {
    return (
      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-ink">
        <p className="font-medium">Falta rodar a migração.</p>
        <p className="mt-1 text-muted">
          Os pacotes precisam de <code>0144_catalogo_rico.sql</code>. Rode no Supabase e recarregue.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted">
          Monte o pacote com itens do catálogo. A margem aparece enquanto você monta — meta atual: {metaMargin}%.
        </p>
        <button
          type="button"
          onClick={() => setRascunho({ ...VAZIO })}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Novo pacote
        </button>
      </div>

      {rascunho && (
        <Editor
          rascunho={rascunho}
          catalogo={catalogo}
          metaMargin={metaMargin}
          ocupado={ocupado === "salvar"}
          onChange={setRascunho}
          onCancel={() => setRascunho(null)}
          onSave={salvar}
        />
      )}

      {carregando ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      ) : pacotes.length === 0 && !rascunho ? (
        <div className="rounded-xl border border-line bg-surface p-10 text-center text-sm text-muted">
          Nenhum pacote montado ainda.
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {pacotes.map((p) => (
            <CartaoPacote
              key={p.id}
              p={p}
              metaMargin={metaMargin}
              ocupado={ocupado === p.id}
              onEdit={() =>
                setRascunho({
                  id: p.id,
                  name: p.name,
                  clientHint: p.clientHint ?? "",
                  notes: p.notes ?? "",
                  discount: p.discount,
                  itens: p.itens,
                })
              }
              onDelete={() => excluir(p.id)}
              onPropose={() => gerarProposta(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Editor ─────────────────────────────────────────────────────────────── */

function Editor({
  rascunho, catalogo, metaMargin, ocupado, onChange, onCancel, onSave,
}: {
  rascunho: Rascunho;
  catalogo: ServiceCatalog[];
  metaMargin: number;
  ocupado: boolean;
  onChange: (r: Rascunho) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const totais = useMemo(
    () => totaisDoPacote(rascunho.itens, rascunho.discount),
    [rascunho.itens, rascunho.discount],
  );
  const set = (patch: Partial<Rascunho>) => onChange({ ...rascunho, ...patch });
  const setItem = (i: number, patch: Partial<ItemPacote>) =>
    set({ itens: rascunho.itens.map((it, k) => (k === i ? { ...it, ...patch } : it)) });

  function adicionar(servico: ServiceCatalog, planoId: string) {
    const plano = servico.plans.find((p) => p.id === planoId);
    if (!plano) return;
    set({
      itens: [
        ...rascunho.itens,
        {
          label: rotuloDoPlano(servico.name, plano.name),
          qty: 1,
          price: plano.price,
          cost: plano.cost,
          cadence: normalizarCadencia(plano.cadence),
        },
      ],
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand-400/40 bg-surface p-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          className={campo}
          placeholder="Nome do pacote (ex.: Social Completo)"
          value={rascunho.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <input
          className={campo}
          placeholder="Para quem (ex.: Padaria do Zé)"
          value={rascunho.clientHint}
          onChange={(e) => set({ clientHint: e.target.value })}
        />
      </div>

      <SeletorDoCatalogo catalogo={catalogo} onAdd={adicionar} />

      {rascunho.itens.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-4 text-center text-xs text-muted">
          Adicione itens do catálogo acima.
        </p>
      ) : (
        <div className="space-y-1.5">
          <div className="grid grid-cols-[1fr_56px_96px_96px_104px_32px] gap-1.5 px-1 text-[11px] uppercase tracking-wide text-muted">
            <span>Item</span><span>Qtd</span><span>Preço</span><span>Custo</span><span>Cadência</span><span />
          </div>
          {rascunho.itens.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_56px_96px_96px_104px_32px] items-center gap-1.5">
              <input className={campo} value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
              <input
                className={campo}
                inputMode="numeric"
                value={it.qty}
                onChange={(e) => setItem(i, { qty: Math.max(1, Math.round(num(e.target.value))) })}
              />
              <input
                className={campo}
                inputMode="decimal"
                value={it.price}
                onChange={(e) => setItem(i, { price: num(e.target.value) })}
              />
              <input
                className={cn(campo, it.cost > it.price && "border-rose-400 text-rose-600")}
                inputMode="decimal"
                value={it.cost}
                onChange={(e) => setItem(i, { cost: num(e.target.value) })}
              />
              <select
                className={campo}
                value={it.cadence}
                onChange={(e) => setItem(i, { cadence: e.target.value as Cadencia })}
              >
                {CADENCIAS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
              <button
                type="button"
                onClick={() => set({ itens: rascunho.itens.filter((_, k) => k !== i) })}
                className="flex h-9 w-8 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-rose-600"
                aria-label="Remover item"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Desconto
          <input
            className={cn(campo, "w-20")}
            inputMode="decimal"
            value={rascunho.discount}
            onChange={(e) => set({ discount: Math.min(100, num(e.target.value)) })}
          />
          %
        </label>
      </div>

      <Totais totais={totais} metaMargin={metaMargin} />

      <textarea
        className="min-h-[64px] w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-brand-400"
        placeholder="Observações que entram na proposta (opcional)"
        value={rascunho.notes}
        onChange={(e) => set({ notes: e.target.value })}
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm text-muted hover:bg-black/5"
        >
          <X className="h-4 w-4" /> Cancelar
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={ocupado}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-600 px-3 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Salvar
        </button>
      </div>
    </div>
  );
}

function SeletorDoCatalogo({
  catalogo, onAdd,
}: { catalogo: ServiceCatalog[]; onAdd: (s: ServiceCatalog, planoId: string) => void }) {
  const comPlanos = catalogo.filter((s) => s.active && s.plans.length > 0);
  const [servicoId, setServicoId] = useState("");
  const servico = comPlanos.find((s) => s.id === servicoId);

  if (comPlanos.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">
        Nenhum serviço com plano cadastrado. Cadastre em <strong>Catálogo de serviços</strong>, acima.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-black/[0.02] p-2">
      <select className={cn(campo, "w-auto min-w-[180px] flex-1")} value={servicoId} onChange={(e) => setServicoId(e.target.value)}>
        <option value="">Escolha um serviço…</option>
        {comPlanos.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {servico && (
        <div className="flex flex-wrap gap-1.5">
          {servico.plans.filter((p) => p.active).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAdd(servico, p.id)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink hover:border-brand-400"
            >
              <Plus className="h-3.5 w-3.5 text-brand-600" />
              {p.name} <span className="text-xs text-muted">{fmtBRL(p.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Totais e alerta de margem ──────────────────────────────────────────── */

function Totais({ totais, metaMargin }: { totais: TotaisPacote; metaMargin: number }) {
  const v = avaliarMargem(totais.ano.margemPct, metaMargin);
  const cor =
    v.nivel === "prejuizo" ? "border-rose-500/40 bg-rose-500/10 text-rose-700"
      : v.nivel === "abaixo" ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
        : v.nivel === "ok" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700"
          : "border-line bg-black/[0.02] text-muted";

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        <Bloco titulo="Recorrente" sufixo="/mês" b={totais.mensal} />
        <Bloco titulo="Pontual" sufixo="" b={totais.unico} />
        <Bloco titulo="12 meses" sufixo="" b={totais.ano} destaque />
      </div>
      <div className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", cor)}>
        {v.nivel === "ok" ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
        <span>{v.texto}</span>
      </div>
    </div>
  );
}

function Bloco({
  titulo, sufixo, b, destaque,
}: {
  titulo: string;
  sufixo: string;
  b: TotaisPacote["mensal"];
  destaque?: boolean;
}) {
  return (
    <div className={cn("rounded-lg border border-line p-2.5", destaque ? "bg-brand-600/[0.06]" : "bg-surface")}>
      <div className="text-[11px] uppercase tracking-wide text-muted">{titulo}</div>
      <div className="text-base font-semibold text-ink">
        {fmtBRL(b.receita)}<span className="text-xs font-normal text-muted">{sufixo}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted">
        custo {fmtBRL(b.custo)} · margem {b.margemPct == null ? "—" : `${b.margemPct}%`}
      </div>
    </div>
  );
}

/* ── Cartão do pacote salvo ─────────────────────────────────────────────── */

function CartaoPacote({
  p, metaMargin, ocupado, onEdit, onDelete, onPropose,
}: {
  p: Pacote;
  metaMargin: number;
  ocupado: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onPropose: () => void;
}) {
  const v = avaliarMargem(p.totais.ano.margemPct, metaMargin);
  // Caminho relativo aqui e absoluto só no clique: `window` no corpo do render
  // quebra no SSR do componente cliente no dia em que a lista vier pronta do
  // servidor.
  const caminho = p.proposta ? `/proposta/${p.proposta.token}` : null;

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button type="button" onClick={onEdit} className="truncate text-left font-medium text-ink hover:text-brand-600">
            {p.name}
          </button>
          {p.clientHint && <div className="truncate text-xs text-muted">para {p.clientHint}</div>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onPropose}
            disabled={ocupado}
            title="Gerar proposta com link público"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-brand-600 disabled:opacity-50"
          >
            {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:bg-black/5 hover:text-rose-600"
            aria-label="Excluir pacote"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        {p.totais.mensal.receita > 0 && (
          <span className="font-semibold text-ink">{fmtBRL(p.totais.mensal.receita)}<span className="text-xs font-normal text-muted">/mês</span></span>
        )}
        {p.totais.unico.receita > 0 && (
          <span className="text-ink">{fmtBRL(p.totais.unico.receita)} <span className="text-xs text-muted">uma vez</span></span>
        )}
        {p.discount > 0 && <span className="text-xs text-amber-600">−{p.discount}%</span>}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            v.nivel === "prejuizo" ? "bg-rose-500/15 text-rose-700"
              : v.nivel === "abaixo" ? "bg-amber-500/15 text-amber-700"
                : v.nivel === "ok" ? "bg-emerald-500/15 text-emerald-700"
                  : "bg-black/5 text-muted",
          )}
        >
          margem {p.totais.ano.margemPct == null ? "—" : `${p.totais.ano.margemPct}%`}
        </span>
      </div>

      <div className="mt-2 text-xs text-muted">
        {p.itens.length} {p.itens.length === 1 ? "item" : "itens"}
      </div>

      {p.proposta && caminho && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-black/[0.02] px-2.5 py-2 text-xs">
          <FileText className="h-3.5 w-3.5 text-brand-600" />
          <span className="text-muted">Proposta</span>
          {p.proposta.signedAt ? (
            <span className="text-emerald-600">assinada</span>
          ) : p.proposta.viewedAt ? (
            <span className="inline-flex items-center gap-1 text-brand-600"><Eye className="h-3 w-3" /> vista</span>
          ) : (
            <span className="text-muted">enviada, ainda não aberta</span>
          )}
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(`${window.location.origin}${caminho}`).catch(() => {});
              toast("Link copiado.", "success");
            }}
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-muted hover:border-brand-400 hover:text-brand-600"
          >
            <Copy className="h-3 w-3" /> Copiar link
          </button>
        </div>
      )}
    </div>
  );
}
