import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { getEditorialLineView } from "@/lib/data/queries";
import { LogoHorizontal } from "@/components/brand/logo";
import { LePrintButton } from "@/components/gerencial/le-print-button";
import type { EditorialFormat, EditorialPost } from "@/lib/data/operacao";

export const dynamic = "force-dynamic";

const ACCENTS = ["#2563eb", "#f472b6", "#d9f558", "#f5e0cf"]; // azul · rosa · lima · areia
const inkOn = (hex: string) => (hex === "#d9f558" || hex === "#f5e0cf" ? "#0f172a" : "#ffffff");

function countFormat(posts: EditorialPost[], f: EditorialFormat) {
  return posts.filter((p) => p.format === f).length;
}

// Divide os posts em 4 semanas (o arco do mês).
function intoWeeks(posts: EditorialPost[]): EditorialPost[][] {
  if (posts.length === 0) return [[], [], [], []];
  const per = Math.ceil(posts.length / 4);
  return [0, 1, 2, 3].map((i) => posts.slice(i * per, i * per + per));
}

function Slide({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`le-slide relative mx-auto flex aspect-video w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-sm ${className}`}>
      {children}
    </section>
  );
}

export default async function ApresentarLE({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") notFound();
  const { id } = await params;
  const le = await getEditorialLineView(id);

  const total = le.posts.length;
  const reels = countFormat(le.posts, "Reels");
  const carros = countFormat(le.posts, "Carrossel");
  const estaticos = countFormat(le.posts, "Feed");
  const stories = countFormat(le.posts, "Stories");
  const weeks = intoWeeks(le.posts);

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{`
        @media print {
          @page { size: landscape; margin: 0; }
          .le-slide { break-after: page; box-shadow: none !important; border-radius: 0 !important; max-width: 100% !important; }
        }
      `}</style>
      {/* Barra de topo (some na impressão) */}
      <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between px-4 print:hidden">
        <Link href={`/gerencial/clientes/${id}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Voltar à ficha
        </Link>
        <LePrintButton />
      </div>

      <div className="space-y-6 px-4 print:space-y-0 print:px-0">
        {/* 01 · Capa */}
        <Slide className="justify-between p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">{le.clientName} · planejamento de conteúdos</p>
          <div>
            <h1 className="text-6xl font-black leading-none tracking-tight text-brand-600">LINHA<br />EDITORIAL</h1>
            <p className="mt-3 text-2xl font-semibold text-slate-800">{le.month}</p>
            {le.objetivo && le.objetivo !== "—" && <p className="mt-2 max-w-2xl text-lg text-slate-600">{le.objetivo}</p>}
            <div className="mt-5 flex flex-wrap gap-2 text-sm font-bold">
              <span className="rounded bg-brand-600 px-3 py-1 text-white">4 SEMANAS</span>
              <span className="rounded bg-lime-300 px-3 py-1 text-slate-900">{total} POSTS</span>
              <span className="rounded bg-rose-300 px-3 py-1 text-slate-900">{reels} REELS</span>
              <span className="rounded bg-orange-100 px-3 py-1 text-slate-900">{carros} CARROSSÉIS · {estaticos} ESTÁTICOS{stories ? ` · ${stories} STORIES` : ""}</span>
            </div>
          </div>
          <LogoHorizontal className="h-6 text-brand-600" />
        </Slide>

        {/* 02 · Narrativa central */}
        <Slide className="p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">O que amarra o mês inteiro</p>
          <h2 className="mt-1 text-4xl font-black text-brand-600">NARRATIVA CENTRAL</h2>
          <div className="mt-8 grid flex-1 grid-cols-2 gap-10">
            <div className="border-l-4 border-lime-300 pl-5">
              <p className="text-2xl font-bold leading-snug text-slate-900">{le.narrativaCentral}</p>
              {le.tensaoNarrativa && le.tensaoNarrativa !== "—" && (
                <p className="mt-4 text-base text-slate-600">{le.tensaoNarrativa}</p>
              )}
            </div>
            <div className="space-y-4">
              {le.pillars.slice(0, 3).map((p) => (
                <div key={p.name}>
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-900">{p.name}</p>
                  <p className="text-sm text-slate-600">Eixo temático · {p.posts || 0} posts no mês</p>
                </div>
              ))}
            </div>
          </div>
        </Slide>

        {/* 03 · Pilares */}
        <Slide className="p-12">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-brand-600">Toda pauta nasce de um deles</p>
          <h2 className="mt-1 text-4xl font-black text-brand-600">OS PILARES DE CONTEÚDO</h2>
          <div className="mt-8 grid flex-1 grid-cols-2 gap-4 md:grid-cols-4">
            {(le.pillars.length ? le.pillars : [{ name: "Sem pilares", posts: 0, color: "#94a3b8" }]).slice(0, 4).map((p, i) => {
              const bg = p.color || ACCENTS[i % ACCENTS.length];
              return (
                <div key={p.name} className="rounded-xl p-5" style={{ background: bg, color: inkOn(bg) }}>
                  <p className="text-2xl font-black opacity-40">P{i + 1}</p>
                  <p className="mt-2 text-lg font-bold uppercase leading-tight">{p.name}</p>
                  <p className="mt-2 text-sm opacity-90">{p.posts || 0} posts no mês</p>
                </div>
              );
            })}
          </div>
        </Slide>

        {/* 04 · Visão do mês */}
        <Slide className="p-0">
          <div className="bg-brand-600 px-12 py-8 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-white/70">O arco das 4 semanas</p>
            <h2 className="text-4xl font-black">VISÃO DO MÊS</h2>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-6 p-12 md:grid-cols-4">
            {weeks.map((w, i) => (
              <div key={i} className="border-t-4 pt-3" style={{ borderColor: ACCENTS[i % ACCENTS.length] }}>
                <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Semana {i + 1}</p>
                <ul className="mt-2 space-y-1">
                  {w.map((p) => (
                    <li key={p.n} className="text-sm text-slate-700">
                      <span className="font-semibold">{String(p.n).padStart(2, "0")}</span> {p.format} — {p.title}
                    </li>
                  ))}
                  {w.length === 0 && <li className="text-sm text-slate-400">—</li>}
                </ul>
              </div>
            ))}
          </div>
        </Slide>

        {/* 05-08 · Semanas com posts */}
        {weeks.map((w, i) =>
          w.length === 0 ? null : (
            <Slide key={`wk-${i}`} className="p-0">
              <div className="px-12 py-6" style={{ background: ACCENTS[i % ACCENTS.length], color: inkOn(ACCENTS[i % ACCENTS.length]) }}>
                <p className="text-xs font-bold uppercase tracking-[0.3em] opacity-70">Semana {i + 1}</p>
                <h2 className="text-3xl font-black uppercase">{w[0]?.pillar || "Conteúdos"}</h2>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-4 p-10">
                {w.slice(0, 4).map((p) => (
                  <div key={p.n} className="rounded-xl bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-900">
                      <span className="text-brand-600">{String(p.n).padStart(2, "0")}</span> {p.format.toUpperCase()} · {p.pillar || "—"}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-800">{p.title}</p>
                    {p.description && <p className="mt-1 line-clamp-4 text-xs text-slate-600">{p.description}</p>}
                  </div>
                ))}
              </div>
            </Slide>
          ),
        )}

        {/* 09 · Fechamento */}
        <Slide className="bg-slate-900 p-12 text-white">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-lime-300">Fechamento</p>
          <h2 className="mt-1 text-5xl font-black leading-none">UM MÊS INTEIRO<br />COM UMA SÓ NARRATIVA.</h2>
          <div className="mt-8 flex flex-wrap gap-10">
            {[
              [total, "Posts planejados"],
              [reels, "Reels"],
              [carros, "Carrosséis"],
              [estaticos, "Estáticos"],
            ].map(([n, l]) => (
              <div key={l as string}>
                <p className="text-5xl font-black text-lime-300">{n}</p>
                <p className="text-sm text-white/70">{l}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-3xl text-lg text-white/80">{le.narrativaCentral}</p>
        </Slide>
      </div>
    </div>
  );
}
