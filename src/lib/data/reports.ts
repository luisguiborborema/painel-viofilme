/**
 * Central de Relatórios — resolver de métricas por cliente (client-safe).
 * Valores determinísticos por id (mock até a integração Meta acender), para o
 * preview e para o PDF baterem, variando por cliente.
 */
import { formatBRL, formatCompact, formatNumber } from "@/lib/utils";
import type { ReportSummary } from "./operacao";

function seed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(s: number) {
  let x = s;
  return () => {
    x |= 0;
    x = (x + 0x6d2b79f5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Resumo do relatório determinístico por id de cliente. */
export function resolveReportSummary(clientId: string): ReportSummary {
  const r = rng(seed(clientId));
  const invest = 2000 + Math.round(r() * 8000);
  const leads = 40 + Math.round(r() * 500);
  const conv = Math.round(leads * (0.15 + r() * 0.25));
  const clicks = leads * (6 + Math.round(r() * 6));
  return {
    organic: {
      seguidores: 80 + Math.round(r() * 1200),
      alcance: 20000 + Math.round(r() * 200000),
      engajamento: Math.round((2 + r() * 6) * 10) / 10,
      impressoes: 40000 + Math.round(r() * 400000),
      comentarios: 20 + Math.round(r() * 400),
      salvamentos: 30 + Math.round(r() * 600),
    },
    paid: {
      investimento: invest,
      leads,
      cpl: Math.round((invest / Math.max(1, leads)) * 100) / 100,
      conversoes: conv,
      cliques: clicks,
      cpa: Math.round((invest / Math.max(1, conv)) * 100) / 100,
    },
  };
}

export function organicValue(key: string, s: ReportSummary): string {
  const o = s.organic;
  switch (key) {
    case "seguidores": return `+${formatNumber(o.seguidores)}`;
    case "alcance": return formatCompact(o.alcance);
    case "engajamento": return `${o.engajamento.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    case "comentarios": return formatNumber(o.comentarios);
    case "salvamentos": return formatNumber(o.salvamentos);
    case "impressoes": return formatCompact(o.impressoes);
    default: return "—";
  }
}

export function paidValue(key: string, s: ReportSummary): string {
  const p = s.paid;
  switch (key) {
    case "investimento": return `R$ ${formatNumber(p.investimento)}`;
    case "leads": return formatNumber(p.leads);
    case "cpl": return formatBRL(p.cpl);
    case "conversoes": return formatNumber(p.conversoes);
    case "cliques": return formatNumber(p.cliques);
    case "cpa": return formatBRL(p.cpa);
    default: return "—";
  }
}
