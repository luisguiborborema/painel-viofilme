/**
 * Pré-checagem da configuração da Meta.
 *
 * Conectar a Meta tem muitos passos fora do painel — criar o app, registrar a
 * URL de retorno, pedir permissões em App Review, colocar as variáveis na
 * Vercel. Quando algo não bate, o erro aparece lá na frente, como uma tela do
 * Facebook dizendo "URL bloqueada", e ninguém sabe qual dos passos falhou.
 *
 * Isto verifica antes o que dá para verificar de dentro do painel, para o
 * problema aparecer no lugar onde ele se resolve.
 *
 * Client-safe: só tipos e comparação pura.
 */

export type NivelCheck = "ok" | "atencao" | "falta";

export type Checagem = {
  nivel: NivelCheck;
  titulo: string;
  detalhe: string;
};

/** Host de uma URL, sem porta. Devolve "" quando não dá para ler. */
export function hostDe(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/**
 * O domínio configurado é o mesmo por onde a pessoa está acessando?
 *
 * Este é o erro que mais custa tempo. `NEXT_PUBLIC_APP_URL` monta a URL de
 * retorno do OAuth, e a Meta compara essa URL com a registrada no app —
 * caractere a caractere. Se o painel é servido em `www.viofilme.com.br` mas a
 * variável diz `viofilme.com.br`, a volta do login passa por um redirecionamento
 * de domínio no meio do fluxo: o cookie de state é do host de origem e pode não
 * acompanhar, derrubando a conexão com "erro=state" sem explicar nada.
 */
export function dominioBate(appUrl: string, hostAtual: string): boolean {
  const a = hostDe(appUrl);
  const b = String(hostAtual ?? "").toLowerCase().split(":")[0];
  if (!a || !b) return true; // sem como comparar, não inventa alarme
  return a === b;
}

export type EntradaDiagnostico = {
  appId: string;
  temSecret: boolean;
  appUrl: string;
  /** Host pelo qual a pessoa está acessando o painel agora. */
  hostAtual: string;
  redirectUri: string;
};

/**
 * Lista de checagens, em ordem de quem bloqueia primeiro.
 *
 * Só entra aqui o que o painel consegue afirmar sozinho. Se a permissão saiu da
 * App Review ou se a URL foi mesmo registrada no app, só a Meta sabe — e dizer
 * "tudo certo" sobre algo que não foi verificado é pior que não dizer nada.
 */
export function diagnosticarMeta(e: EntradaDiagnostico): Checagem[] {
  const checks: Checagem[] = [];

  checks.push(
    e.appId
      ? { nivel: "ok", titulo: "App ID definido", detalhe: `NEXT_PUBLIC_META_APP_ID = ${e.appId}` }
      : {
          nivel: "falta",
          titulo: "App ID não definido",
          detalhe: "Defina NEXT_PUBLIC_META_APP_ID nas variáveis da Vercel (Production) e faça redeploy.",
        },
  );

  checks.push(
    e.temSecret
      ? { nivel: "ok", titulo: "App Secret definido", detalhe: "META_APP_SECRET está no servidor." }
      : {
          nivel: "falta",
          titulo: "App Secret não definido",
          detalhe: "Defina META_APP_SECRET nas variáveis da Vercel (Production) e faça redeploy.",
        },
  );

  const bate = dominioBate(e.appUrl, e.hostAtual);
  checks.push(
    bate
      ? {
          nivel: "ok",
          titulo: "Domínio de retorno confere",
          detalhe: `A volta do login vai para ${hostDe(e.appUrl) || e.appUrl}, o mesmo domínio desta página.`,
        }
      : {
          nivel: "atencao",
          titulo: "Domínio de retorno diferente do que você está usando",
          detalhe:
            `Você está em ${e.hostAtual} e a URL de retorno aponta para ${hostDe(e.appUrl)}. ` +
            `A volta do login passaria por um redirecionamento de domínio, que pode derrubar a conexão. ` +
            `Ajuste NEXT_PUBLIC_APP_URL para https://${e.hostAtual} — e registre a URL de retorno com esse mesmo domínio no app da Meta.`,
        },
  );

  checks.push({
    nivel: "atencao",
    titulo: "Registre esta URL de retorno no app da Meta",
    detalhe: `${e.redirectUri} — em Facebook Login → Settings → Valid OAuth Redirect URIs. A Meta compara caractere a caractere.`,
  });

  return checks;
}

/** Dá para tentar conectar? Só o que falta de verdade bloqueia. */
export function podeConectar(checks: Checagem[]): boolean {
  return !checks.some((c) => c.nivel === "falta");
}
