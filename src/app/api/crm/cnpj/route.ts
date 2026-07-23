import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Consulta automática de CNPJ (casca + fallback manual).
 * Tenta a ReceitaWS pública (sem chave) para pré-preencher razão social,
 * cidade/UF e segmento no cadastro outbound. Qualquer falha/timeout retorna
 * { ok: false } — o SDR preenche na mão, sem travar a tela.
 */
export async function GET(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const cnpj = (new URL(req.url).searchParams.get("cnpj") ?? "").replace(/\D/g, "");
  if (cnpj.length !== 14) {
    return NextResponse.json({ ok: false, reason: "CNPJ inválido" });
  }

  // Se a Edge Function estiver configurada (provedor pago / ponto único),
  // delega a ela. Senão, ReceitaWS inline (fallback grátis, sempre disponível).
  const fnUrl = process.env.CNPJ_LOOKUP_URL;
  if (fnUrl) {
    try {
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
      const r = await fetch(`${fnUrl}?cnpj=${cnpj}`, { headers: { Authorization: `Bearer ${key}`, apikey: key } });
      if (r.ok) return NextResponse.json(await r.json());
    } catch {
      /* cai no fallback ReceitaWS abaixo */
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://receitaws.com.br/v1/cnpj/${cnpj}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return NextResponse.json({ ok: false, reason: "indisponível" });
    const d = (await res.json()) as {
      status?: string;
      nome?: string;
      fantasia?: string;
      municipio?: string;
      uf?: string;
      atividade_principal?: { text?: string }[];
    };
    if (d.status === "ERROR") return NextResponse.json({ ok: false, reason: "não encontrado" });
    return NextResponse.json({
      ok: true,
      name: d.nome ?? d.fantasia ?? "",
      cidadeUf: d.municipio && d.uf ? `${d.municipio}/${d.uf}` : d.uf ?? "",
      segment: d.atividade_principal?.[0]?.text ?? "",
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "falha na consulta" });
  } finally {
    clearTimeout(timer);
  }
}
