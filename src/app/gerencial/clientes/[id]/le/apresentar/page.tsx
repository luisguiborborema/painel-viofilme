import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getEditorialLineView } from "@/lib/data/queries";
import { LogoHorizontal } from "@/components/brand/logo";
import { LePrintButton } from "@/components/gerencial/le-print-button";
import type { EditorialPost, EditorialRef } from "@/lib/data/operacao";

export const dynamic = "force-dynamic";

// Paleta do template D'Belém.
const BLUE = "#2f6ff0";
const LIME = "#d6f24e";
const DARK = "#191a1b";
const PB = "#e9eefb"; // pastel azul
const PL = "#eef7cf"; // pastel lima
const PP = "#fdeee2"; // pastel pêssego

type Kind = "video" | "carrossel" | "estatico";
function kindOf(f: string): Kind {
  if (f === "Carrossel") return "carrossel";
  if (f === "Feed") return "estatico";
  return "video"; // Reels / Stories
}
const nonEmpty = (p: EditorialPost) => (p.title && p.title.trim()) || (p.tema && p.tema.trim());
const clip = (s: string | undefined, n: number) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s ?? "");
const imgs = (refs: EditorialRef[] | undefined) =>
  (refs ?? []).filter((r) => (r.kind === "image" || !r.kind) && r.url).slice(0, 4);

function PageNo({ n }: { n: string }) {
  return (
    <span className="pointer-events-none absolute right-10 top-8 text-[110px] font-black leading-none" style={{ color: BLUE, opacity: 0.08 }}>
      {n}
    </span>
  );
}

function Slide({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <section
      className="le-slide relative mx-auto flex aspect-video w-full max-w-[1120px] flex-col overflow-hidden rounded-xl px-14 py-12 shadow-sm"
      style={{ background: dark ? DARK : "#ffffff" }}
    >
      {children}
    </section>
  );
}

function Footer({ contact }: { contact?: string }) {
  return (
    <div className="mt-auto flex items-end justify-between pt-6">
      <div className="flex items-center gap-2" style={{ color: BLUE }}>
        <LogoHorizontal className="h-5" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.25em]" style={{ opacity: 0.55 }}>
          Estratégia · Marketing · Dados
        </span>
      </div>
      {contact && <span className="text-[11px] text-slate-400">{contact}</span>}
    </div>
  );
}

export default async function ApresentarLE({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") notFound();
  const { id } = await params;
  const le = await getEditorialLineView(id);

  const posts = le.posts.filter(nonEmpty);
  const videos = posts.filter((p) => kindOf(p.format) === "video");
  const carros = posts.filter((p) => kindOf(p.format) === "carrossel");
  const estaticos = posts.filter((p) => kindOf(p.format) === "estatico");
  const total = posts.length;

  let page = 1;
  const pno = () => String(page++).padStart(2, "0");

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          .le-slide { break-after: page; box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; height: 100vh; }
        }
      `}</style>

      {/* Barra de topo (some na impressão) */}
      <div className="mx-auto mb-4 flex max-w-[1120px] items-center justify-between px-4 print:hidden">
        <Link href={`/gerencial/clientes/${id}/editorial?le=${le.id ?? ""}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Voltar à linha
        </Link>
        <LePrintButton />
      </div>

      <div className="space-y-6 px-4 print:space-y-0 print:px-0">
        {/* 01 · Capa */}
        <Slide>
          <PageNo n={pno()} />
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>{le.clientName}</p>
          <div className="mt-auto">
            <h1 className="text-[76px] font-black uppercase leading-[0.92] tracking-tight" style={{ color: BLUE }}>
              Linha<br />Editorial
            </h1>
            <p className="mt-3 text-2xl text-slate-800">
              {videos.length} vídeos · {carros.length} carrosséis · {estaticos.length} estáticos
            </p>
            <p className="mt-1 text-lg text-slate-500">{le.month}</p>
          </div>
          <Footer />
        </Slide>

        {/* 02 · O Conceito */}
        <Slide dark>
          <div className="mt-auto max-w-4xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: LIME }}>O conceito</p>
            <h2 className="mt-3 text-[44px] font-black uppercase leading-[1.05] text-white">
              {le.narrativaCentral && le.narrativaCentral !== "—" ? le.narrativaCentral : le.objetivo || "Uma narrativa que amarra o mês inteiro."}
            </h2>
            {le.tensaoNarrativa && le.tensaoNarrativa !== "—" && (
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/70">{le.tensaoNarrativa}</p>
            )}
            {le.objetivo && le.objetivo !== "—" && le.narrativaCentral && le.narrativaCentral !== "—" && (
              <p className="mt-3 max-w-3xl text-base leading-relaxed text-white/60">{le.objetivo}</p>
            )}
          </div>
        </Slide>

        {/* 03 · Método Viofilme (marca) */}
        <Slide>
          <PageNo n={pno()} />
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>O checklist de um bom roteiro</p>
          <h2 className="mt-1 text-4xl font-bold tracking-tight text-slate-800">Método Viofilme</h2>
          <div className="mt-6 grid grid-cols-5 gap-3">
            {[
              { n: "01", t: "Resolve um problema", bg: PB, fg: BLUE },
              { n: "02", t: "Gera boca a boca", bg: "#fbe1e4", fg: "#b03a4a" },
              { n: "03", t: "Tem voz e clareza", bg: LIME, fg: "#5b6b16" },
              { n: "04", t: "Conecta com o dia a dia", bg: PP, fg: "#a9682f" },
              { n: "05", t: "Deixa um sentimento", bg: DARK, fg: LIME },
            ].map((c) => (
              <div key={c.n} className="rounded-lg p-4" style={{ background: c.bg }}>
                <p className="text-2xl font-black opacity-40" style={{ color: c.fg }}>{c.n}</p>
                <p className="mt-1 text-sm font-medium" style={{ color: c.n === "05" ? "#ffffff" : "#1f2937" }}>{c.t}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 grid flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-6">
            <div className="rounded-xl p-5" style={{ background: PB }}>
              <p className="text-sm font-bold uppercase" style={{ color: BLUE }}>Autenticidade se dirige, não se finge.</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Não é encenação — é uma situação real, com direção clara de câmera e narração. A pessoa faz o que faria de qualquer forma; a gente sabe onde apontar a câmera.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {[
                { t: "PROBLEMA", bg: DARK },
                { t: "TENSÃO", bg: "#8f1d2d" },
                { t: "VIRADA", bg: BLUE },
                { t: "SENTIMENTO", bg: "#6f7d1e" },
              ].map((s, i, a) => (
                <div key={s.t} className="flex items-center gap-2">
                  <span className="rounded px-3 py-3 text-[11px] font-bold text-white" style={{ background: s.bg }}>{s.t}</span>
                  {i < a.length - 1 && <span className="text-slate-400">→</span>}
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* 04 · Visão geral das peças */}
        <Slide>
          <PageNo n={pno()} />
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>As {total} peças do mês</p>
          <h2 className="mt-1 text-4xl font-bold tracking-tight text-slate-800">Visão geral da linha editorial</h2>
          <div className="mt-6 space-y-3">
            {([
              { label: "Vídeos", items: videos, bg: DARK, fg: "#ffffff", tag: "rgba(255,255,255,.55)" },
              { label: "Carrosséis", items: carros, bg: PL, fg: "#1f2937", tag: "#5b6b16" },
              { label: "Estáticos", items: estaticos, bg: PP, fg: "#1f2937", tag: "#a9682f" },
            ] as const).map((row) =>
              row.items.length === 0 ? null : (
                <div key={row.label} className="grid grid-cols-4 gap-2.5">
                  {row.items.map((p, i) => (
                    <div key={p.id} className="rounded-lg p-3" style={{ background: row.bg, color: row.fg }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: row.tag }}>
                        {row.label.replace(/s$/, "")} {i + 1} · {p.format}
                      </p>
                      <p className="mt-1 text-sm font-semibold leading-snug">{clip(p.title || p.tema, 60)}</p>
                    </div>
                  ))}
                </div>
              ),
            )}
            {total === 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-3 text-sm text-amber-700">
                Nenhuma peça cadastrada nesta linha editorial ainda.
              </p>
            )}
          </div>
        </Slide>

        {/* 05..N · Uma seção por VÍDEO */}
        {videos.map((p) => {
          const board = imgs(p.references);
          return (
            <Slide key={`v-${p.id}`}>
              <PageNo n={pno()} />
              <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>
                Vídeo{" "}
                <span className="ml-1 rounded px-2 py-0.5 text-[10px] text-white" style={{ background: BLUE }}>{p.format}</span>
              </p>
              <h2 className="mt-1 text-3xl font-bold uppercase tracking-tight text-slate-800">{p.title || p.tema}</h2>
              <div className="mt-5 grid flex-1 grid-cols-[minmax(0,1fr)_260px] gap-6">
                <div className="min-w-0 space-y-3">
                  {(p.tema || p.title) && (
                    <div className="rounded-r-lg border-l-4 py-3 pl-4 pr-3" style={{ borderColor: LIME, background: PL }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#5b6b16" }}>A mensagem</p>
                      <p className="mt-0.5 text-base font-medium text-slate-800">{p.tema || p.title}</p>
                    </div>
                  )}
                  {p.shotlist && p.shotlist.length > 0 ? (
                    <div className="overflow-hidden rounded-lg border border-slate-200">
                      <div className="grid grid-cols-[70px_minmax(0,1fr)_minmax(0,1fr)] bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        <span>Tempo</span>
                        <span>Imagem</span>
                        <span>Legenda</span>
                      </div>
                      {p.shotlist.map((s, i) => (
                        <div key={i} className="grid grid-cols-[70px_minmax(0,1fr)_minmax(0,1fr)] border-t border-slate-100 px-3 py-1.5 text-xs">
                          <span className="font-medium text-slate-500">{s.tempo}</span>
                          <span className="pr-2 text-slate-700">{s.imagem}</span>
                          <span style={{ color: BLUE }}>{s.legenda}</span>
                        </div>
                      ))}
                    </div>
                  ) : p.description ? (
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Roteiro / copy</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm italic leading-relaxed text-slate-700">{p.description}</p>
                    </div>
                  ) : null}
                  {p.legenda && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Legenda</p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{p.legenda}</p>
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide" style={{ color: BLUE }}>Vision board</p>
                  {board.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5">
                      {board.map((r) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={r.id} src={r.url} alt="" className="h-24 w-full rounded-md object-cover" />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-md border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] text-slate-400">
                      {p.artDirection || "Sem referências"}
                    </div>
                  )}
                </div>
              </div>
              <div className="-mx-14 -mb-12 mt-4 px-14 py-3 text-center text-[11px] font-bold uppercase tracking-wide" style={{ background: DARK, color: LIME }}>
                {p.pillar ? `Pilar · ${p.pillar}` : "Direção de arte"}{p.artDirection ? ` · ${p.artDirection}` : ""}
              </div>
            </Slide>
          );
        })}

        {/* Carrosséis do mês */}
        {carros.length > 0 && (
          <Slide>
            <PageNo n={pno()} />
            <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>{carros.length} carrosséis</p>
            <h2 className="mt-1 text-4xl font-bold tracking-tight text-slate-800">Os carrosséis do mês</h2>
            <div className="mt-6 grid flex-1 grid-cols-2 gap-3">
              {carros.slice(0, 6).map((p, i) => (
                <div key={p.id} className="rounded-lg p-4" style={{ background: [PB, PL, PP, "#fbe8ec"][i % 4] }}>
                  <p className="text-sm font-bold uppercase" style={{ color: BLUE }}>{p.title || p.tema}</p>
                  {p.tema && p.tema !== p.title && <p className="mt-0.5 text-sm text-slate-600">{p.tema}</p>}
                  {p.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{clip(p.description, 220)}</p>}
                </div>
              ))}
            </div>
          </Slide>
        )}

        {/* Estáticos */}
        {estaticos.length > 0 && (
          <Slide>
            <PageNo n={pno()} />
            <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>{estaticos.length} estáticos</p>
            <h2 className="mt-1 text-4xl font-bold tracking-tight text-slate-800">Uma frase + uma imagem</h2>
            <div className="mt-6 grid flex-1 grid-cols-2 gap-3">
              {estaticos.slice(0, 6).map((p, i) => (
                <div key={p.id} className="rounded-lg p-5" style={{ background: [PB, PL, "#fbe8ec", PP][i % 4] }}>
                  <p className="text-base font-bold" style={{ color: BLUE }}>{p.legenda || p.title || p.tema}</p>
                  {(p.tema || p.description) && <p className="mt-1 text-sm text-slate-600">{clip(p.tema || p.description, 160)}</p>}
                </div>
              ))}
            </div>
          </Slide>
        )}

        {/* Guia de produção (equipe) */}
        <Slide dark>
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: LIME }}>Para a equipe Viofilme</p>
          <h2 className="mt-1 text-4xl font-bold uppercase text-white">Guia de produção</h2>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { t: "Câmera", d: "Câmera lenta (0,5x / 60fps), planos fechados e sensoriais — mãos, vapor, detalhe.", hl: false },
              { t: "Luz e equipamento", d: "Luz natural de manhã. Tripé sempre.", hl: false },
              { t: "Áudio", d: "Narração gravada à parte, em ambiente silencioso.", hl: false },
              { t: "Legendas", d: "Minimalistas, brancas, palavra a palavra.", hl: false },
              { t: "Trilha", d: "Suave, coerente com o tom da marca.", hl: false },
              { t: "Regra-chave", d: "Situação real dirigida + só o protagonista.", hl: true },
            ].map((c) => (
              <div key={c.t} className="rounded-lg border p-4" style={{ background: c.hl ? LIME : "#232425", borderColor: c.hl ? LIME : "#333" }}>
                <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: c.hl ? BLUE : LIME }}>{c.t}</p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: c.hl ? "#1f2937" : "rgba(255,255,255,.8)" }}>{c.d}</p>
              </div>
            ))}
          </div>
        </Slide>

        {/* Fechamento */}
        <Slide>
          <PageNo n={pno()} />
          <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: BLUE }}>{le.clientName}</p>
          <div className="mt-auto">
            <h2 className="text-[64px] font-black uppercase leading-[0.95]" style={{ color: BLUE }}>
              Uma história.<br />{total} peças.
            </h2>
            <p className="mt-4 max-w-2xl text-lg text-slate-500">
              {le.objetivo && le.objetivo !== "—" ? le.objetivo : "Cada peça parte de algo real — sem encenação."}
            </p>
          </div>
          <Footer contact="contato@viofilme.com.br" />
        </Slide>
      </div>
    </div>
  );
}
