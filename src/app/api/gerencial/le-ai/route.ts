import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = new Set(["narrativa", "tensao", "pilares", "temas"]);

type Body = { kind?: string; clientId?: string; extra?: string };

/** Proxy p/ a Edge Function le-ai-suggest — monta o briefing real do cliente. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.kind || !KINDS.has(b.kind)) {
    return NextResponse.json({ error: "kind inválido" }, { status: 400 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, enabled: false, reason: "IA indisponível no modo demo." });
  }

  // Briefing real do cliente (quando houver) para dar contexto à sugestão.
  let clientBrief = "";
  if (b.clientId) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("name, segment, brief_objetivo, brief_tom, brief_publico, brief_concorrentes, brief_restricoes")
      .eq("id", b.clientId)
      .maybeSingle();
    const c = data as Record<string, string | null> | null;
    if (c) {
      clientBrief = [
        `Cliente: ${c.name ?? "—"}`,
        `Segmento: ${c.segment ?? "—"}`,
        c.brief_objetivo && `Objetivo: ${c.brief_objetivo}`,
        c.brief_tom && `Tom de voz: ${c.brief_tom}`,
        c.brief_publico && `Público: ${c.brief_publico}`,
        c.brief_concorrentes && `Concorrentes: ${c.brief_concorrentes}`,
        c.brief_restricoes && `Restrições: ${c.brief_restricoes}`,
      ]
        .filter(Boolean)
        .join("\n");
    }
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/le-ai-suggest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ kind: b.kind, clientBrief, extra: b.extra ?? "" }),
  }).catch(() => null);

  if (!res) {
    return NextResponse.json({ ok: false, enabled: false, reason: "Falha ao contatar a IA." });
  }
  const data = await res.json().catch(() => ({}));
  // Repassa inclusive o 501 "desligada" — o front trata graciosamente.
  return NextResponse.json(data, { status: res.ok ? 200 : res.status });
}
