"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorialPost } from "@/lib/data/operacao";
import { COLUNAS, TIPOS, tipoDoPost } from "@/lib/data/editorial-kanban";
import {
  agruparBarras, cargaPorSemana, ddmm, janelaDaTimeline, semData,
  type PostNaTimeline,
} from "@/lib/data/editorial-timeline";

/**
 * Linha do tempo das postagens.
 *
 * A barra vai da data de entrega à data de postagem — ela É a janela de
 * produção, não um enfeite. Lado a lado, mostra o que o kanban esconde: semana
 * sobrecarregada, prazo apertado e post que vai ao ar sem folga.
 */
const CORES = new Map(COLUNAS.map((c) => [c.tipo, c.cor]));

export function EditorialTimeline({
  posts, onAbrir,
}: {
  posts: EditorialPost[];
  onAbrir: (post: EditorialPost) => void;
}) {
  const [agrupamento, setAgrupamento] = useState<"tipo" | "responsavel">("tipo");

  const paraTimeline: PostNaTimeline[] = useMemo(
    () => posts.map((p) => ({
      id: String(p.id ?? p.n),
      n: p.n,
      titulo: p.title || "(sem título)",
      tipo: tipoDoPost(p.format),
      entrega: p.deliveryDate || null,
      postagem: p.postDateIso || null,
      responsavel: p.assignee || null,
    })),
    [posts],
  );
  const porId = useMemo(() => new Map(posts.map((p) => [String(p.id ?? p.n), p])), [posts]);

  const janela = useMemo(() => janelaDaTimeline(paraTimeline), [paraTimeline]);
  const linhas = useMemo(
    () => (janela ? agruparBarras(paraTimeline, janela, agrupamento, TIPOS) : []),
    [paraTimeline, janela, agrupamento],
  );
  const orfaos = useMemo(() => semData(paraTimeline), [paraTimeline]);
  const carga = useMemo(() => cargaPorSemana(paraTimeline), [paraTimeline]);
  const picoSemanal = Math.max(0, ...carga.map((c) => c.entregas));

  if (!janela) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-10 text-center">
        <p className="text-sm text-muted">
          Nenhuma postagem tem data ainda. Preencha entrega e postagem no kanban
          para a linha do tempo aparecer.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Linha do tempo</h3>
          <p className="text-[11px] text-muted">
            Cada barra vai da <strong>entrega</strong> à <strong>postagem</strong> — é a janela de produção.
          </p>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line text-xs">
          {([["tipo", "Por tipo"], ["responsavel", "Por responsável"]] as const).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setAgrupamento(k)}
              className={cn("px-2.5 py-1 font-medium", agrupamento === k ? "bg-ink text-surface" : "bg-surface text-muted hover:text-ink")}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {picoSemanal >= 5 && (
        <p className="flex items-center gap-1.5 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          Há semana com <strong>{picoSemanal} entregas</strong> — vale distribuir antes de fechar a linha.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <div className="min-w-[760px]">
          {/* Régua de semanas */}
          <div className="relative h-8 border-b border-line bg-subtle/40">
            {janela.semanas.map((s) => (
              <span key={s.iso} className="absolute top-0 h-full border-l border-line" style={{ left: `${s.left}%` }}>
                <span className="ml-1 text-[10px] font-medium text-muted">{s.label}</span>
              </span>
            ))}
            {janela.hoje && (
              <span className="absolute top-0 h-full border-l-2 border-brand-500" style={{ left: `${janela.hoje.left}%` }}>
                <span className="ml-1 text-[10px] font-semibold text-brand-600">hoje</span>
              </span>
            )}
          </div>

          {linhas.map((linha) => (
            <div key={linha.chave} className="border-b border-line last:border-0">
              <div className="flex items-center gap-2 px-3 pt-2">
                {agrupamento === "tipo" && (
                  <span className="h-2 w-2 rounded-full" style={{ background: CORES.get(linha.chave as never) ?? "#94a3b8" }} />
                )}
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink">
                  {agrupamento === "tipo" ? COLUNAS.find((c) => c.tipo === linha.chave)?.label ?? linha.label : linha.label}
                </span>
                <span className="text-[11px] text-muted">{linha.barras.length}</span>
              </div>

              <div className="space-y-1 px-3 py-2">
                {linha.barras.map((b) => {
                  const post = porId.get(b.post.id);
                  const cor = CORES.get(b.post.tipo as never) ?? "#94a3b8";
                  return (
                    <div key={b.post.id} className="relative h-7">
                      {/* Fundo da faixa, para a barra ter referência visual */}
                      <div className="absolute inset-y-2 left-0 right-0 rounded bg-subtle/60" />
                      {janela.semanas.map((s) => (
                        <span key={s.iso} className="absolute inset-y-0 border-l border-line/60" style={{ left: `${s.left}%` }} />
                      ))}
                      <button
                        onClick={() => post && onAbrir(post)}
                        title={`${b.post.titulo}\n${ddmm(b.inicio)} → ${ddmm(b.fim)}${b.folgaDias !== null ? ` · ${b.folgaDias} dia(s) de folga` : ""}`}
                        className={cn(
                          "absolute inset-y-1 flex items-center overflow-hidden rounded-md px-2 text-left text-[11px] font-medium text-white transition-opacity hover:opacity-85",
                          b.invertida && "ring-2 ring-amber-500",
                        )}
                        style={{
                          left: `${b.left}%`,
                          width: `${b.width}%`,
                          background: b.pontual ? `${cor}99` : cor,
                          minWidth: 26,
                        }}
                      >
                        <span className="truncate">{b.post.titulo}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-muted">
        Barra clara = só uma das datas preenchida. Contorno âmbar = entrega depois da postagem.
      </p>

      {orfaos.length > 0 && (
        <div className="rounded-2xl border border-dashed border-line p-3">
          <p className="mb-1.5 text-[11px] font-semibold text-ink">
            Sem data ainda ({orfaos.length})
          </p>
          <p className="mb-2 text-[10px] text-muted">
            Não cabem na linha do tempo — mas some daqui seria pior do que mostrar.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {orfaos.map((o) => {
              const post = porId.get(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => post && onAbrir(post)}
                  className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted hover:text-ink"
                >
                  {o.titulo}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
