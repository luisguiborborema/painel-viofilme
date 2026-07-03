import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { exchangeCode, getUserEmail, saveConnection } from "@/lib/google/client";
import { GOOGLE_SCOPES } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Callback do OAuth do Google: troca o code e salva os tokens da agência. */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const back = (q: string) =>
    NextResponse.redirect(new URL(`/gerencial/integracoes?${q}`, request.url));

  if (error) return back("gerro=negado");
  if (!code || !state) return back("gerro=invalido");

  const store = await cookies();
  const saved = store.get("google_oauth_state")?.value;
  store.delete("google_oauth_state");
  if (!saved || saved !== state) return back("gerro=state");

  try {
    const tokens = await exchangeCode(code);
    const email = await getUserEmail(tokens.access_token);
    await saveConnection({
      email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      scopes: GOOGLE_SCOPES.join(" "),
    });
    return back(`gok=${encodeURIComponent(email ?? "Google")}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "erro";
    return back(`gerro=${encodeURIComponent(msg)}`);
  }
}
