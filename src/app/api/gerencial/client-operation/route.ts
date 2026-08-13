import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const str = (v: unknown) => (v == null ? "" : String(v).trim());
type Body = {
  clientId?: string;
  responsibles?: { social?: string; performance?: string; designer?: string; copy?: string };
  services?: string[];
};

/** Atualiza a operação do cliente: responsáveis por função + serviços. */
export async function POST(req: Request) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  if (user.readOnly) {
    return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.clientId) return NextResponse.json({ error: "clientId ausente" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, persisted: false });

  const patch: Record<string, unknown> = {};
  if (b.responsibles && typeof b.responsibles === "object") {
    patch.responsibles = {
      social: str(b.responsibles.social),
      performance: str(b.responsibles.performance),
      designer: str(b.responsibles.designer),
      copy: str(b.responsibles.copy),
    };
  }
  if (Array.isArray(b.services)) {
    patch.services_list = [...new Set(b.services.map(str).filter(Boolean))].slice(0, 12);
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true });

  const supabase = await createClient();
  const { error } = await supabase.from("clients").update(patch).eq("id", b.clientId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
