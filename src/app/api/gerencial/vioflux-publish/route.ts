import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { id?: string };

/** Publica um post via Edge Function vioflux-publish (FLX04.3). Casca até a App Review. */
export async function POST(req: Request) {
  const user = await getSession();
  if (user?.readOnly) return NextResponse.json({ error: "acesso somente leitura" }, { status: 403 });
  if (!user || user.role !== "gerencial") {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  let b: Body;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!b.id) return NextResponse.json({ error: "id ausente" }, { status: 400 });

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, enabled: false, reason: "Publicação indisponível no modo demo." });
  }
  const supabase = await createClient();

  const { data: post } = await supabase
    .from("vioflux_posts")
    .select("id, client_id, caption, media_url")
    .eq("id", b.id)
    .maybeSingle();
  const p = post as { id: string; client_id: string; caption: string | null; media_url: string | null } | null;
  if (!p) return NextResponse.json({ error: "post não encontrado" }, { status: 404 });
  if (!p.media_url) {
    return NextResponse.json({ ok: false, enabled: false, reason: "Post sem mídia hospedada — anexe a mídia antes de publicar." });
  }

  const { data: conn } = await supabase
    .from("meta_connections")
    .select("ig_user_id")
    .eq("client_id", p.client_id)
    .maybeSingle();
  const igUserId = (conn as { ig_user_id: string | null } | null)?.ig_user_id;
  if (!igUserId) {
    return NextResponse.json({ ok: false, enabled: false, reason: "Cliente sem conta IG Business conectada (item de onboarding)." });
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/vioflux-publish`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ postId: p.id, igUserId, imageUrl: p.media_url, caption: p.caption ?? "" }),
  }).catch(() => null);

  if (!res) return NextResponse.json({ ok: false, enabled: false, reason: "Falha ao contatar a publicação." });
  const data = await res.json().catch(() => ({}));

  // Sucesso real → fecha o ciclo: marca publicado.
  if (res.ok && data.ok) {
    await supabase
      .from("vioflux_posts")
      .update({ state: "publicado", updated_at: new Date().toISOString() })
      .eq("id", p.id);
    return NextResponse.json({ ok: true, mediaId: data.mediaId });
  }
  // 501/erro → repassa o motivo (o front cai no modo manual).
  return NextResponse.json(data, { status: res.status });
}
