import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { mergeDeck } from "@/lib/data/deck";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salva os textos da apresentação (Método/Guia) do cliente em clients.deck_config. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: { clientId?: string; config?: unknown; overrides?: Record<string, unknown> };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });
  const supabase = await createClient();

  // Edição inline: mescla só os overrides no deck_config existente.
  if (b.overrides && typeof b.overrides === "object") {
    const { data } = await supabase.from("clients").select("deck_config").eq("id", b.clientId).maybeSingle();
    const current = mergeDeck((data as { deck_config?: unknown } | null)?.deck_config);
    const ov: Record<string, string> = { ...current.overrides };
    for (const [k, v] of Object.entries(b.overrides)) {
      const key = String(k).slice(0, 80);
      const val = String(v ?? "").slice(0, 2000);
      if (!key) continue;
      if (val.trim()) ov[key] = val;
      else delete ov[key];
    }
    const merged = { ...current, overrides: ov };
    const { error } = await supabase.from("clients").update({ deck_config: merged }).eq("id", b.clientId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, persisted: true });
  }

  const config = mergeDeck(b.config); // normaliza no formato canônico
  const { error } = await supabase.from("clients").update({ deck_config: config }).eq("id", b.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
