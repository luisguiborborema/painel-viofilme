import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { buscarTudo } from "./paginate-server";

export type ApiLogRow = {
  id: string;
  createdAt: string;
  method: string;
  path: string;
  source: string;
  status: number;
  ok: boolean;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
  error: string | null;
  /** Quem chamou, quando a rota sabe dizer (ex.: nome da chave de API). */
  actor: string | null;
  /** Detalhe da chamada — no MCP, a ferramenta pedida. */
  meta: Record<string, unknown> | null;
};

export type ApiLogsData = {
  logs: ApiLogRow[];
  sources: string[];
  resumo: {
    total: number;
    erros: number;
    taxaErro: number;
    duracaoMedia: number;
    porFonte: { source: string; total: number; erros: number }[];
    porDia: { dia: string; total: number; erros: number }[];
  };
  /** Tabela ainda não existe (migração 0129 não rodada). */
  semTabela: boolean;
  /** O período tem mais chamadas do que coube na agregação: os números abaixo
   *  são de uma amostra, não do total. */
  resumoIncompleto?: boolean;
};

const VAZIO: ApiLogsData = {
  logs: [],
  sources: [],
  resumo: { total: 0, erros: 0, taxaErro: 0, duracaoMedia: 0, porFonte: [], porDia: [] },
  semTabela: false,
};

// `actor` identifica quem chamou quando a rota sabe dizer — no MCP, o nome da
// chave de API usada. `meta` guarda o detalhe (no MCP, a ferramenta pedida).
const COLS = "id, created_at, method, path, source, status, ok, duration_ms, ip, user_agent, error, actor, meta";

/** Logs de API com filtros. `days` 0 = tudo. */
export async function getApiLogs(opts: { days?: number; source?: string; onlyErrors?: boolean; limit?: number } = {}): Promise<ApiLogsData> {
  if (!isSupabaseConfigured()) return VAZIO;
  const days = opts.days ?? 7;
  const limit = Math.min(Math.max(opts.limit ?? 200, 1), 500);

  try {
    const supabase = await createClient();
    const since = days > 0 ? new Date(Date.now() - days * 86_400_000).toISOString() : null;

    // Lista paginada (o que a tabela mostra).
    let q = supabase.from("api_logs").select(COLS).order("created_at", { ascending: false }).limit(limit);
    if (since) q = q.gte("created_at", since);
    if (opts.source) q = q.eq("source", opts.source);
    if (opts.onlyErrors) q = q.eq("ok", false);
    const { data, error } = await q;
    if (error) {
      if (/api_logs|42P01|does not exist/i.test(error.message)) return { ...VAZIO, semTabela: true };
      return VAZIO;
    }

    /**
     * Agregado do período (independe dos filtros de fonte/erro da tabela).
     *
     * Paginado com teto: taxa de erro e duração média calculadas sobre uma
     * amostra truncada dariam um número plausível e errado — e é justamente
     * nesta tela que alguém vai decidir se algo está quebrado.
     */
    const TETO_AGREGADO = 60_000;
    const { linhas: agg, truncado } = await buscarTudo<{
      source: string; ok: boolean; duration_ms: number; created_at: string;
    }>((de, ate) => {
      const q = supabase.from("api_logs").select("source, ok, duration_ms, created_at").range(de, ate);
      return since ? q.gte("created_at", since) : q;
    }, { teto: TETO_AGREGADO });
    const rows = agg;

    const porFonteMap = new Map<string, { total: number; erros: number }>();
    const porDiaMap = new Map<string, { total: number; erros: number }>();
    let somaDuracao = 0;
    let erros = 0;
    for (const r of rows) {
      somaDuracao += Number(r.duration_ms ?? 0);
      if (!r.ok) erros++;
      const f = porFonteMap.get(r.source) ?? { total: 0, erros: 0 };
      f.total++;
      if (!r.ok) f.erros++;
      porFonteMap.set(r.source, f);
      const dia = String(r.created_at).slice(0, 10);
      const d = porDiaMap.get(dia) ?? { total: 0, erros: 0 };
      d.total++;
      if (!r.ok) d.erros++;
      porDiaMap.set(dia, d);
    }

    return {
      logs: (data ?? []).map((r) => ({
        id: String(r.id),
        createdAt: String(r.created_at),
        method: String(r.method),
        path: String(r.path),
        source: String(r.source),
        status: Number(r.status ?? 0),
        ok: Boolean(r.ok),
        durationMs: Number(r.duration_ms ?? 0),
        ip: r.ip ? String(r.ip) : null,
        userAgent: r.user_agent ? String(r.user_agent) : null,
        error: r.error ? String(r.error) : null,
        actor: r.actor ? String(r.actor) : null,
        meta: r.meta && typeof r.meta === "object" ? (r.meta as Record<string, unknown>) : null,
      })),
      resumoIncompleto: truncado,
      sources: [...porFonteMap.keys()].sort(),
      resumo: {
        total: rows.length,
        erros,
        taxaErro: rows.length > 0 ? Math.round((erros / rows.length) * 1000) / 10 : 0,
        duracaoMedia: rows.length > 0 ? Math.round(somaDuracao / rows.length) : 0,
        porFonte: [...porFonteMap.entries()]
          .map(([source, v]) => ({ source, ...v }))
          .sort((a, b) => b.erros - a.erros || b.total - a.total),
        porDia: [...porDiaMap.entries()].map(([dia, v]) => ({ dia, ...v })).sort((a, b) => a.dia.localeCompare(b.dia)),
      },
      semTabela: false,
    };
  } catch {
    return VAZIO;
  }
}
