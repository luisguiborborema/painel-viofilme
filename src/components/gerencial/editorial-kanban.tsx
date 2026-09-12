"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, CalendarDays, Check, Columns3, Loader2,
  MoreVertical, Plus, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorialPost } from "@/lib/data/operacao";
import {
  COLUNAS, TIPOS, descreverPendencias, cardPronto, tipoDoPost,
  type TipoPostagem,
} from "@/lib/data/editorial-kanban";

/**
 * Kanban de postagens da linha editorial.
 *
 * Cada card nasce aberto com os seis campos que importam — o social media
 * preenche na coluna e segue. A ficha completa (pilar, moodboard, decupagem)
 * continua no menu do card, para quem precisa dela.
 */

const inputCls =
  "w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition-colors focus:border-brand-400 placeholder:text-muted/70";
const rotulo = "mb-0.5 block text-[11px] font-medium text-muted";

export type SalvarPost = (post: EditorialPost) => Promise<boolean>;

/* ------------------------------- Card ------------------------------------- */

function CardPostagem({
  post, coluna, team, onSalvar, onExcluir, onAbrirFicha,
}: {
  post: EditorialPost;
  coluna: (typeof COLUNAS)[number];
  team: string[];
  onSalvar: SalvarPost;
  onExcluir: () => void;
  onAbrirFicha: () => void;
}) {
  const [f, setF] = useState(post);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [menu, setMenu] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Salva sozinho, com folga: o card é editado campo a campo e ninguém deveria
  // precisar clicar em "salvar" seis vezes por post.
  const agendarSalvar = useCallback((proximo: EditorialPost) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSalvando(true);
      const ok = await onSalvar(proximo);
      setSalvando(false);
      if (ok) { setSalvo(true); setTimeout(() => setSalvo(false), 1500); }
    }, 700);
  }, [onSalvar]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function muda<K extends keyof EditorialPost>(campo: K, valor: EditorialPost[K]) {
    const proximo = { ...f, [campo]: valor };
    setF(proximo);
    agendarSalvar(proximo);
  }

  const pendencia = descreverPendencias({
    title: f.title,
    description: f.description,
    legenda: f.legenda,
    deliveryDate: f.deliveryDate,
    postDateIso: f.postDateIso,
    assignee: f.assignee,
  });
  const pronto = !pendencia;
  // Entrega depois da postagem: o conteúdo ficaria pronto atrasado.
  const invertido = Boolean(f.deliveryDate && f.postDateIso && f.deliveryDate > f.postDateIso);

  return (
    <div className={cn(
      "rounded-2xl border bg-surface p-3 transition-colors",
      pronto ? "border-line" : "border-dashed border-line",
    )}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className="rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide"
          style={{ background: `${coluna.cor}1a`, color: coluna.cor }}
        >
          {coluna.badge}
        </span>
        <span className="flex items-center gap-1.5">
          {salvando && <Loader2 className="h-3 w-3 animate-spin text-muted" />}
          {salvo && !salvando && <Check className="h-3 w-3 text-emerald-500" />}
          <span className="relative">
            <button
              onClick={() => setMenu((v) => !v)}
              className="rounded-md p-0.5 text-muted hover:bg-subtle hover:text-ink"
              aria-label="Mais ações"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
            {menu && (
              <>
                <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMenu(false)} aria-label="Fechar menu" />
                <span className="absolute right-0 z-20 mt-1 flex w-52 flex-col overflow-hidden rounded-xl border border-line bg-surface py-1 shadow-lg">
                  <button
                    onClick={() => { setMenu(false); onAbrirFicha(); }}
                    className="px-3 py-1.5 text-left text-xs text-ink hover:bg-subtle"
                  >
                    Abrir ficha completa
                    <span className="block text-[10px] text-muted">pilar, moodboard, decupagem</span>
                  </button>
                  <button
                    onClick={() => { setMenu(false); onExcluir(); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-left text-xs text-rose-500 hover:bg-subtle"
                  >
                    <Trash2 className="h-3 w-3" /> Excluir postagem
                  </button>
                </span>
              </>
            )}
          </span>
        </span>
      </div>

      <label className="block">
        <span className={rotulo}>Título</span>
        <input
          value={f.title}
          onChange={(e) => muda("title", e.target.value)}
          placeholder="Adicionar título..."
          className={inputCls}
        />
      </label>

      <label className="mt-2 block">
        <span className={rotulo}>Roteiro</span>
        <textarea
          value={f.description ?? ""}
          onChange={(e) => muda("description", e.target.value)}
          placeholder={
            coluna.tipo === "Reels" ? "Roteiro — gancho, desenvolvimento e CTA"
              : coluna.tipo === "Carrossel" ? "Copy, lâmina por lâmina..."
                : coluna.tipo === "Extra" ? "Descreva o que precisa ser feito..."
                  : "Copy do post..."
          }
          rows={2}
          className={inputCls + " resize-y"}
        />
      </label>

      <label className="mt-2 block">
        <span className={rotulo}>Legenda</span>
        <textarea
          value={f.legenda ?? ""}
          onChange={(e) => muda("legenda", e.target.value)}
          placeholder="Legenda que vai junto com a postagem..."
          rows={2}
          className={inputCls + " resize-y"}
        />
      </label>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <label className="block">
          <span className={rotulo}>Data de entrega</span>
          <input
            type="date"
            value={f.deliveryDate ?? ""}
            onChange={(e) => muda("deliveryDate", e.target.value)}
            className={cn(inputCls, invertido && "border-amber-500")}
          />
        </label>
        <label className="block">
          <span className={rotulo}>Data de postagem</span>
          <input
            type="date"
            value={f.postDateIso ?? ""}
            onChange={(e) => muda("postDateIso", e.target.value)}
            className={cn(inputCls, invertido && "border-amber-500")}
          />
        </label>
      </div>

      {invertido && (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-amber-600">
          <AlertTriangle className="h-3 w-3" /> A entrega está depois da postagem.
        </p>
      )}

      <label className="mt-2 block">
        <span className={rotulo}>
          Link de referência <span className="font-normal text-muted/70">opcional</span>
        </span>
        <input
          value={f.referenceUrl ?? ""}
          onChange={(e) => muda("referenceUrl", e.target.value)}
          placeholder="Colar link de referência"
          className={inputCls}
        />
      </label>

      <label className="mt-2 block">
        <span className={rotulo}>Responsável</span>
        <select
          value={f.assignee ?? ""}
          onChange={(e) => muda("assignee", e.target.value)}
          className={inputCls}
        >
          <option value="">Selecionar</option>
          {[...new Set([...team, f.assignee].filter(Boolean))].map((n) => (
            <option key={n} value={n as string}>{n}</option>
          ))}
        </select>
      </label>

      {pendencia && (
        <p className="mt-2 text-[10px] text-muted">Para concluir, {pendencia}.</p>
      )}
    </div>
  );
}

/* ------------------------------ Kanban ------------------------------------ */

export function EditorialKanban({
  posts, team, onSalvar, onExcluir, onNovo, onAbrirFicha,
}: {
  posts: EditorialPost[];
  team: string[];
  onSalvar: SalvarPost;
  onExcluir: (post: EditorialPost) => void;
  onNovo: (tipo: TipoPostagem) => void;
  onAbrirFicha: (post: EditorialPost) => void;
}) {
  const porTipo = useMemo(() => {
    const m = new Map<TipoPostagem, EditorialPost[]>(TIPOS.map((t) => [t, []]));
    for (const p of posts) m.get(tipoDoPost(p.format))!.push(p);
    for (const lista of m.values()) lista.sort((a, b) => a.n - b.n);
    return m;
  }, [posts]);

  const prontos = posts.filter((p) => cardPronto({
    title: p.title, description: p.description, legenda: p.legenda,
    deliveryDate: p.deliveryDate, postDateIso: p.postDateIso, assignee: p.assignee,
  })).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Postagens — kanban por tipo</h3>
          <p className="text-[11px] text-muted">
            Cada card já nasce aberto para preenchimento. Sem subtask — é só preencher.
          </p>
        </div>
        <span className="text-[11px] text-muted">
          <strong className={prontos === posts.length && posts.length > 0 ? "text-emerald-500" : "text-ink"}>
            {prontos}
          </strong>
          {" "}de {posts.length} prontos
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
        {COLUNAS.map((coluna) => {
          const lista = porTipo.get(coluna.tipo) ?? [];
          return (
            <div key={coluna.tipo} className="rounded-2xl bg-subtle/50 p-2">
              <div className="mb-2 flex items-center justify-between px-1.5 pt-1">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-ink">
                  <span className="h-2 w-2 rounded-full" style={{ background: coluna.cor }} />
                  {coluna.label}
                </span>
                <span className="text-[11px] text-muted">{lista.length}</span>
              </div>
              {coluna.hint && lista.length === 0 && (
                <p className="px-1.5 pb-2 text-[10px] leading-snug text-muted">{coluna.hint}</p>
              )}

              <div className="space-y-2">
                {lista.map((p) => (
                  <CardPostagem
                    key={p.id ?? p.n}
                    post={p}
                    coluna={coluna}
                    team={team}
                    onSalvar={onSalvar}
                    onExcluir={() => onExcluir(p)}
                    onAbrirFicha={() => onAbrirFicha(p)}
                  />
                ))}
              </div>

              <button
                onClick={() => onNovo(coluna.tipo)}
                className="mt-2 w-full rounded-xl border border-dashed border-line py-2 text-xs font-medium text-brand-600 hover:bg-surface"
              >
                <Plus className="mr-1 inline h-3 w-3" /> Nova postagem
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------- Alternador de visão --------------------------- */

export type Visao = "kanban" | "timeline";

export function AlternadorDeVisao({ visao, onChange }: { visao: Visao; onChange: (v: Visao) => void }) {
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
      {([
        ["kanban", "Kanban", Columns3],
        ["timeline", "Linha do tempo", CalendarDays],
      ] as const).map(([k, label, Icone]) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 font-medium",
            visao === k ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink",
          )}
        >
          <Icone className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}
