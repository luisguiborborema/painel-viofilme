"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { findTour, type Tour } from "@/lib/tours";

type TourCtx = { hasTour: boolean; start: () => void };
const Ctx = createContext<TourCtx>({ hasTour: false, start: () => {} });

/** Hook para telas/botões dispararem o tutorial da rota atual. */
export function useTour() {
  return useContext(Ctx);
}

const seenKey = (id: string) => `vio-tour:${id}`;

export function TourProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const tour = useMemo(() => findTour(pathname), [pathname]);
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  const start = useCallback(() => {
    if (!tour) return;
    setStep(0);
    setActive(true);
  }, [tour]);

  const finish = useCallback(() => {
    setActive(false);
    if (tour && typeof window !== "undefined") {
      try {
        localStorage.setItem(seenKey(tour.id), "1");
      } catch {
        /* localStorage indisponível — sem gating */
      }
    }
  }, [tour]);

  // Abertura automática no primeiro acesso à rota (uma vez por tour).
  useEffect(() => {
    if (!tour || typeof window === "undefined") return;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey(tour.id)) === "1";
    } catch {
      seen = true;
    }
    if (seen) return;
    const t = window.setTimeout(() => {
      setStep(0);
      setActive(true);
    }, 700);
    return () => window.clearTimeout(t);
  }, [tour]);

  return (
    <Ctx.Provider value={{ hasTour: !!tour, start }}>
      {children}
      {active && tour && (
        <TourOverlay tour={tour} step={step} setStep={setStep} onClose={finish} />
      )}
    </Ctx.Provider>
  );
}

function TourOverlay({
  tour,
  step,
  setStep,
  onClose,
}: {
  tour: Tour;
  step: number;
  setStep: (n: number) => void;
  onClose: () => void;
}) {
  const total = tour.steps.length;
  const current = tour.steps[Math.min(step, total - 1)];
  const [rect, setRect] = useState<DOMRect | null>(null);

  // Mede (e re-mede) o alvo do passo atual, seguindo scroll/resize.
  useEffect(() => {
    const find = () =>
      current.selector
        ? (document.querySelector(current.selector) as HTMLElement | null)
        : null;
    const el = find();
    el?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
    const measure = () => {
      const n = find();
      setRect(n ? n.getBoundingClientRect() : null);
    };
    measure();
    const t1 = window.setTimeout(measure, 300);
    const t2 = window.setTimeout(measure, 650);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [current]);

  const isLast = step >= total - 1;
  const next = () => (isLast ? onClose() : setStep(step + 1));
  const prev = () => setStep(Math.max(0, step - 1));

  // Posição do balão: abaixo do alvo se couber, senão acima; sem alvo → centro.
  const tip: React.CSSProperties = (() => {
    const W = 340;
    if (!rect) {
      return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
    }
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const left = Math.min(Math.max(12, rect.left), vw - W - 12);
    const below = rect.bottom + 14;
    if (below + 200 < vh) return { top: below, left, width: W };
    return { top: Math.max(12, rect.top - 14), left, width: W, transform: "translateY(-100%)" };
  })();

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Camada que escurece e bloqueia cliques na tela (sem alvo → tela toda). */}
      {rect ? (
        <div
          className="pointer-events-none fixed rounded-xl ring-2 ring-brand-400 transition-all duration-200"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.55)",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-black/55" />
      )}
      {/* Captura cliques fora do balão para não vazar pra interface. */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Balão do passo */}
      <div
        className="absolute z-10 max-w-[calc(100vw-24px)] rounded-2xl border border-line bg-surface p-4 shadow-2xl"
        style={tip}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            {tour.title} · {step + 1}/{total}
          </span>
          <button
            onClick={onClose}
            className="-mr-1 rounded-lg p-1 text-muted hover:bg-subtle hover:text-ink"
            aria-label="Fechar tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h3 className="text-sm font-bold text-ink">{current.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{current.body}</p>

        <div className="mt-3 flex items-center justify-between gap-2">
          <button onClick={onClose} className="text-xs font-medium text-muted hover:text-ink">
            Pular
          </button>
          <div className="flex items-center gap-1.5">
            {step > 0 && (
              <button
                onClick={prev}
                className="inline-flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </button>
            )}
            <button
              onClick={next}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
            >
              {isLast ? "Concluir" : "Próximo"}
              {!isLast && <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
