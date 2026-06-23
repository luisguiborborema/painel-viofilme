import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { buildAuthorizeUrl, isMetaConfigured } from "@/lib/meta/config";

/**
 * Inicia o fluxo OAuth da Meta para conectar a conta de um cliente.
 * GET /api/meta/connect?client=<clientId>
 */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = request.nextUrl.searchParams.get("client");
  if (!clientId) {
    return NextResponse.redirect(
      new URL("/gerencial/integracoes?erro=cliente", request.url),
    );
  }

  if (!isMetaConfigured()) {
    return NextResponse.redirect(
      new URL("/gerencial/integracoes?erro=config", request.url),
    );
  }

  // State anti-CSRF: guarda no cookie e envia para a Meta.
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ clientId, nonce })).toString(
    "base64url",
  );

  const store = await cookies();
  store.set("meta_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildAuthorizeUrl(state));
}
