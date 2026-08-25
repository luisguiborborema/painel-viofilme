import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

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
};

const VAZIO: ApiLogsData = {
  logs: [],
  sources: [],
  resumo: { total: 0, erros: 0, taxaErro: 0, duracaoMedia: 0, porFonte: [], porDia: [] },
  semTabela: false,
};

// `actor` existe na tabela para uso futuro, mas hoje só as rotas externas
// (sem sessão) são registradas — então nunca é preenchido e não é exibido.
const COLS = "id, created_at, method, path, source, status, ok, duration_ms, ip, user_agent, error";

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

    // Agregado do período (independe dos filtros de fonte/erro da tabela).
    let aggQ = supabase.from("api_logs").select("source, ok, duration_ms, created_at").limit(20000);
    if (since) aggQ = aggQ.gte("created_at", since);
    const { data: agg } = await aggQ;
    const rows = (agg ?? []) as { source: string; ok: boolean; duration_ms: number; created_at: string }[];

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
      })),
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
