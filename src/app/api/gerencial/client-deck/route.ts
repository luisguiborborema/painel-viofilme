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
  let b: { clientId?: string; config?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const config = mergeDeck(b.config); // normaliza no formato canônico
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ deck_config: config }).eq("id", b.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
