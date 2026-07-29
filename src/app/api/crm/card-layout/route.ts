import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { hasFullAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { CARD_PROP_PREFIX, DEAL_CARD_FIELDS, type CardFieldSetting } from "@/lib/data/crm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Salva o layout do card do negócio. Só Gestor (acesso total). */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial" || !hasFullAccess(user.allowedSections)) {
    return NextResponse.json({ error: "não autorizado" }, { status: 403 });
  }

  let b: { objectType?: string; fields?: CardFieldSetting[] };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!Array.isArray(b.fields)) {
    return NextResponse.json({ error: "fields ausente" }, { status: 400 });
  }
  const objectType = b.objectType ?? "deal";
  // Sanitiza: chaves nativas conhecidas OU propriedades customizadas (prop:*).
  const known = new Set(DEAL_CARD_FIELDS.map((f) => f.key));
  const seen = new Set<string>();
  const fields = b.fields
    .filter(
      (f) =>
        f &&
        (known.has(f.key) || f.key.startsWith(CARD_PROP_PREFIX)) &&
        !seen.has(f.key) &&
        seen.add(f.key),
    )
    .map((f) => ({ key: f.key, visible: f.visible !== false }));

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, persisted: false });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("crm_card_layout")
    .upsert(
      { object_type: objectType, fields, updated_at: new Date().toISOString() },
      { onConflict: "object_type" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
