import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { updateSession } from "@/lib/supabase/middleware";
import { DEMO_COOKIE } from "@/lib/auth/demo";

const PROTECTED_PREFIXES = ["/gerencial", "/cliente"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  let response = NextResponse.next({ request });
  let hasSession = false;

  if (isSupabaseConfigured()) {
    const result = await updateSession(request);
    response = result.response;
    hasSession = Boolean(result.user);
  } else {
    // Modo demo: a sessão vive no cookie de demonstração.
    hasSession = Boolean(request.cookies.get(DEMO_COOKIE)?.value);
  }

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  // Bloqueia áreas internas sem sessão.
  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Já logado tentando acessar o login → manda para a raiz (que roteia por papel).
  if (pathname === "/login" && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Aplica a todas as rotas, exceto:
     * - arquivos estáticos do Next (_next/static, _next/image)
     * - favicon e assets de marca
     * - arquivos com extensão (imagens, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
