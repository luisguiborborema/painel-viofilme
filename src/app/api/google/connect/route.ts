import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth/session";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/google/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Inicia o OAuth do Google Calendar (conta única da agência). */
export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "gerencial") {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(
      new URL("/gerencial/integracoes?gerro=config", request.url),
    );
  }

  const state = crypto.randomUUID();
  const store = await cookies();
  store.set("google_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
