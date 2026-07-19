import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "dall-e-3";

type Body = { clientId?: string; extra?: string };

/** Gera uma referência de moodboard (imagem) via OpenAI e hospeda no bucket. */
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

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: false, reason: "OPENAI_API_KEY não configurada." });
  }
  if (!hasServiceRole()) {
    return NextResponse.json({ ok: false, reason: "Upload indisponível (sem service role) para hospedar a imagem." });
  }

  // Contexto do cliente para orientar a estética.
  let segment = "negócio";
  let brief = "";
  if (b.clientId && isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("clients")
      .select("name, segment, brief_tom, brief_publico, brief_objetivo")
      .eq("id", b.clientId)
      .maybeSingle();
    const c = data as Record<string, string | null> | null;
    if (c) {
      segment = c.segment ?? "negócio";
      brief = [c.brief_tom && `Tom: ${c.brief_tom}`, c.brief_publico && `Público: ${c.brief_publico}`, c.brief_objetivo && `Objetivo: ${c.brief_objetivo}`]
        .filter(Boolean)
        .join(" · ");
    }
  }

  const prompt = `Moodboard de referência visual para redes sociais de um cliente do segmento "${segment}". ${brief} ${b.extra ?? ""} Colagem/grade de referências estéticas coesas: paleta harmônica, direção de arte, fotografia e composição. Sem texto nem logotipos. Estilo inspiracional de moodboard.`.trim();

  try {
    const client = new OpenAI();
    const gen = await client.images.generate({
      model: IMAGE_MODEL,
      prompt,
      size: "1024x1024",
      n: 1,
      response_format: "b64_json",
    });
    const b64 = gen.data?.[0]?.b64_json;
    if (!b64) return NextResponse.json({ ok: false, reason: "A IA não retornou imagem." });

    const bytes = Buffer.from(b64, "base64");
    const admin = createAdminClient();
    await admin.storage.createBucket("wa-media", { public: true, fileSizeLimit: "16MB" }).catch(() => {});
    const path = `le-moodboard/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.png`;
    const { error } = await admin.storage.from("wa-media").upload(path, bytes, { contentType: "image/png", upsert: false });
    if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });

    const url = admin.storage.from("wa-media").getPublicUrl(path).data.publicUrl;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ ok: false, reason: e instanceof Error ? e.message : "Falha na geração de imagem." }, { status: 502 });
  }
}
