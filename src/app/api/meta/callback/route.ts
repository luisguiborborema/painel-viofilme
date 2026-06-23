import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForToken,
  getLongLivedToken,
  listPages,
} from "@/lib/meta/client";

/**
 * Callback do OAuth da Meta. Troca o code por token de longa duração,
 * descobre a página/conta do Instagram e persiste em `meta_connections`.
 * GET /api/meta/callback?code=...&state=...
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const integracoes = (q: string) =>
    NextResponse.redirect(new URL(`/gerencial/integracoes?${q}`, request.url));

  if (error) return integracoes("erro=negado");
  if (!code || !state) return integracoes("erro=invalido");

  // Valida o state contra o cookie
  const store = await cookies();
  const saved = store.get("meta_oauth_state")?.value;
  store.delete("meta_oauth_state");
  if (!saved || saved !== state) return integracoes("erro=state");

  let clientId: string;
  try {
    const decoded = JSON.parse(
      Buffer.from(state, "base64url").toString("utf8"),
    );
    clientId = decoded.clientId;
  } catch {
    return integracoes("erro=state");
  }

  try {
    const short = await exchangeCodeForToken(code);
    const long = await getLongLivedToken(short.access_token);
    const pages = await listPages(long.access_token);
    const page = pages.find((p) => p.instagram_business_account) ?? pages[0];

    if (!page) return integracoes("erro=sem_pagina");

    const expiresAt = new Date(
      Date.now() + long.expires_in * 1000,
    ).toISOString();

    if (isSupabaseConfigured()) {
      const supabase = await createClient();
      await supabase.from("meta_connections").upsert(
        {
          client_id: clientId,
          fb_page_id: page.id,
          page_name: page.name,
          ig_user_id: page.instagram_business_account?.id ?? null,
          access_token: page.access_token, // criptografe em produção
          token_expires_at: expiresAt,
          scopes: ["instagram_basic", "instagram_manage_insights"],
        },
        { onConflict: "client_id" },
      );
    }

    return integracoes(`ok=${encodeURIComponent(page.name)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return integracoes(`erro=${encodeURIComponent(msg)}`);
  }
}
