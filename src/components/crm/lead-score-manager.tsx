"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONFIG_PADRAO, calcularScore, tetoTeorico, type ConfigLeadScore,
} from "@/lib/data/lead-score";

/**
 * Pesos do lead score.
 *
 * Antes esta tela montava regras genéricas (campo / operador / valor) que o
 * cálculo nunca leu — dava para configurar e nada mudava. Agora ela edita os
 * pesos dos sete fatores que o score de fato usa.
 *
 * A prévia ao lado existe porque peso isolado não diz nada: o que importa é o
 * número que sai para um lead concreto.
 */
const inputCls =
  "w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-right text-sm tabular-nums text-ink outline-none focus:border-brand-400";

function Linha({
  titulo, hint, children,
}: {
  titulo: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <span className="min-w-0 flex-1">
        <span className="block text-sm text-ink">{titulo}</span>
        {hint && <span className="block text-[11px] leading-snug text-muted">{hint}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2">{children}</span>
    </div>
  );
}

/** Lead de exemplo para a prévia — representa um caso bom, não um caso médio. */
const EXEMPLO = {
  monthlyValue: 3000,
  bant: { budget: "sim", need: "sim" },
  probability: 60,
  source: "Indicação",
  diasDesdeInteracao: 3,
  temTelefone: true,
  temEmail: true,
};

export function LeadScoreManager() {
  const [cfg, setCfg] = useState<ConfigLeadScore>(CONFIG_PADRAO);
  const [carregando, setCarregando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/crm/score-rules")
      .then((r) => r.json())
      .then((j) => { if (j?.config) setCfg(j.config as ConfigLeadScore); })
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function salvar(body: Record<string, unknown>) {
    setBusy(true); setErro(null); setSalvo(false);
    const res = await fetch("/api/crm/score-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) { setErro(j?.error ?? "Não foi possível salvar."); return; }
    if (j?.config) setCfg(j.config as ConfigLeadScore);
    setSalvo(true);
    setTimeout(() => setSalvo(false), 2000);
  }

  const set = (p: Partial<ConfigLeadScore>) => setCfg({ ...cfg, ...p });
  const numero = (v: string, padrao: number) => {
    const n = Number(v.replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : padrao;
  };

  const teto = tetoTeorico(cfg);
  const previa = calcularScore(EXEMPLO, cfg);

  if (carregando) {
    return <div className="flex justify-center p-10"><Loader2 className="h-5 w-5 animate-spin text-muted" /></div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-muted">
        O score ordena a fila: quem a equipe liga primeiro. Ajuste os pesos para refletir
        como vocês qualificam de verdade — um score que não reflete isso vira número
        decorativo e as pessoas param de olhar.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="rounded-xl border border-line bg-surface px-4 py-1">
          <Linha titulo="Valor mensal alto" hint={`A partir de R$ ${cfg.valorAlto.minimo.toLocaleString("pt-BR")}`}>
            <input
              value={cfg.valorAlto.minimo}
              onChange={(e) => set({ valorAlto: { ...cfg.valorAlto, minimo: numero(e.target.value, cfg.valorAlto.minimo) } })}
              inputMode="numeric"
              className={inputCls}
              aria-label="Valor mínimo da faixa alta"
            />
            <input
              value={cfg.valorAlto.pontos}
              onChange={(e) => set({ valorAlto: { ...cfg.valorAlto, pontos: numero(e.target.value, cfg.valorAlto.pontos) } })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Pontos da faixa alta"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          <Linha titulo="Valor mensal médio" hint={`A partir de R$ ${cfg.valorMedio.minimo.toLocaleString("pt-BR")}`}>
            <input
              value={cfg.valorMedio.minimo}
              onChange={(e) => set({ valorMedio: { ...cfg.valorMedio, minimo: numero(e.target.value, cfg.valorMedio.minimo) } })}
              inputMode="numeric"
              className={inputCls}
              aria-label="Valor mínimo da faixa média"
            />
            <input
              value={cfg.valorMedio.pontos}
              onChange={(e) => set({ valorMedio: { ...cfg.valorMedio, pontos: numero(e.target.value, cfg.valorMedio.pontos) } })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Pontos da faixa média"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          <Linha titulo="Qualquer valor acima de zero">
            <input
              value={cfg.valorBaixo.pontos}
              onChange={(e) => set({ valorBaixo: { pontos: numero(e.target.value, cfg.valorBaixo.pontos) } })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Pontos da faixa baixa"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          <Linha titulo="Cada item de BANT preenchido" hint="Orçamento, autoridade, necessidade e prazo — vale 4×">
            <input
              value={cfg.pontosPorBant}
              onChange={(e) => set({ pontosPorBant: numero(e.target.value, cfg.pontosPorBant) })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Pontos por item de BANT"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          <Linha titulo="Etapa do funil" hint="Proporcional à probabilidade da etapa">
            <input
              value={cfg.pesoEtapa}
              onChange={(e) => set({ pesoEtapa: numero(e.target.value, cfg.pesoEtapa) })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Peso máximo da etapa"
            />
            <span className="w-8 text-[11px] text-muted">máx</span>
          </Linha>

          <Linha titulo="Origem quente" hint="Casa por trecho, sem acento — “indica” pega “Indicação”">
            <input
              value={cfg.origemQuente.termo}
              onChange={(e) => set({ origemQuente: { ...cfg.origemQuente, termo: e.target.value } })}
              className={inputCls + " w-28 text-left"}
              aria-label="Termo da origem quente"
            />
            <input
              value={cfg.origemQuente.pontos}
              onChange={(e) => set({ origemQuente: { ...cfg.origemQuente, pontos: numero(e.target.value, cfg.origemQuente.pontos) } })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Pontos da origem quente"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          {cfg.engajamento.map((e, i) => (
            <Linha key={i} titulo={`Interação nos últimos ${e.ateDias} dias`}>
              <input
                value={e.ateDias}
                onChange={(ev) => {
                  const v = [...cfg.engajamento];
                  v[i] = { ...e, ateDias: numero(ev.target.value, e.ateDias) };
                  set({ engajamento: v });
                }}
                inputMode="numeric"
                className={inputCls + " w-14"}
                aria-label="Dias da faixa"
              />
              <input
                value={e.pontos}
                onChange={(ev) => {
                  const v = [...cfg.engajamento];
                  v[i] = { ...e, pontos: numero(ev.target.value, e.pontos) };
                  set({ engajamento: v });
                }}
                inputMode="numeric"
                className={inputCls + " w-14"}
                aria-label="Pontos da faixa"
              />
              <span className="w-8 text-[11px] text-muted">pts</span>
            </Linha>
          ))}

          <Linha titulo="Tem telefone">
            <input
              value={cfg.pontosTelefone}
              onChange={(e) => set({ pontosTelefone: numero(e.target.value, cfg.pontosTelefone) })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Pontos por telefone"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          <Linha titulo="Tem e-mail">
            <input
              value={cfg.pontosEmail}
              onChange={(e) => set({ pontosEmail: numero(e.target.value, cfg.pontosEmail) })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Pontos por e-mail"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          <Linha titulo="Vira quente a partir de" hint="Abaixo do corte morno, o lead é frio">
            <input
              value={cfg.corteQuente}
              onChange={(e) => set({ corteQuente: numero(e.target.value, cfg.corteQuente) })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Corte de quente"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>

          <Linha titulo="Vira morno a partir de">
            <input
              value={cfg.corteMorno}
              onChange={(e) => set({ corteMorno: numero(e.target.value, cfg.corteMorno) })}
              inputMode="numeric"
              className={inputCls + " w-14"}
              aria-label="Corte de morno"
            />
            <span className="w-8 text-[11px] text-muted">pts</span>
          </Linha>
        </div>

        {/* Prévia: peso isolado não diz nada, o número que sai diz. */}
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-subtle/50 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Prévia</p>
            <p className="mt-0.5 text-[11px] leading-snug text-muted">
              Lead de R$ 3.000, com metade do BANT, 60% de probabilidade, vindo de indicação,
              falado há 3 dias, com telefone e e-mail.
            </p>
            <p className="mt-2 text-3xl font-bold text-ink">{previa.score}</p>
            <p className={cn(
              "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
              previa.tier === "hot" ? "bg-rose-500/15 text-rose-600"
                : previa.tier === "warm" ? "bg-amber-500/15 text-amber-600"
                  : "bg-subtle text-muted",
            )}>
              {previa.tier === "hot" ? "Quente" : previa.tier === "warm" ? "Morno" : "Frio"}
            </p>
            <ul className="mt-2 space-y-0.5">
              {previa.factors.map((f) => (
                <li key={f.label} className="flex justify-between text-[11px] text-muted">
                  <span className="truncate">{f.label}</span>
                  <span className="tabular-nums">+{f.points}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className={cn(
            "rounded-xl border p-3 text-[11px] leading-snug",
            teto < cfg.corteQuente ? "border-rose-400/50 bg-rose-500/10 text-rose-700"
              : teto > 150 ? "border-amber-400/50 bg-amber-500/10 text-amber-700"
                : "border-line bg-surface text-muted",
          )}>
            <strong className="text-ink">Máximo possível: {teto} pontos.</strong>{" "}
            {teto < cfg.corteQuente
              ? `Nenhum lead consegue chegar a ${cfg.corteQuente} — ninguém ficaria quente.`
              : teto > 150
                ? "Bem acima de 100: quase todo lead vai bater o teto e a ordem perde sentido."
                : "O score é limitado a 100."}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => { if (window.confirm("Voltar aos pesos padrão?")) salvar({ restaurarPadrao: true }); }}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-2 text-xs font-medium text-muted hover:text-ink disabled:opacity-60"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Restaurar padrão
        </button>
        <span className="flex items-center gap-3">
          {salvo && <span className="inline-flex items-center gap-1 text-xs text-emerald-600"><Check className="h-3.5 w-3.5" /> Salvo</span>}
          {erro && <span className="inline-flex items-center gap-1 text-xs text-rose-500"><AlertTriangle className="h-3.5 w-3.5" /> {erro}</span>}
          <button
            onClick={() => salvar({ config: cfg })}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Salvar pesos
          </button>
        </span>
      </div>
    </div>
  );
}
