import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Atualiza a sessão do Supabase no middleware (renova tokens) e devolve
 * o usuário autenticado, se houver. Mantém os cookies sincronizados.
 */
export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // getClaims() valida o JWT LOCALMENTE (WebCrypto) quando o projeto usa chaves
  // assimétricas — sem round-trip ao servidor de auth a cada navegação. Cai no
  // custo do getUser() só em projetos legados (segredo simétrico): nunca piora.
  // A renovação de token/cookies continua acontecendo aqui (setAll no refresh).
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ? { id: data.claims.sub as string } : null;

  return { response, user };
}
