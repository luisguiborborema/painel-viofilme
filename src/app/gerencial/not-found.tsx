import Link from "next/link";
import { Compass } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { firstAllowedHref } from "@/lib/access";

/**
 * 404 dentro do painel gerencial.
 *
 * Sem este arquivo, `notFound()` num segmento do gerencial renderizava o layout
 * (menu e topo) com o miolo VAZIO: quem caísse numa rota inexistente ou numa
 * tela de admin sem ser admin via uma página em branco, sem explicação e sem
 * saída. Acontecia em /chaves-api, /logs, /monitoramento e /usuarios.
 *
 * O texto não afirma que é falta de permissão de propósito. As telas de admin
 * usam `notFound()` em vez de 403 justamente para não revelar que existem —
 * dizer "você não tem acesso" entregaria a informação que o 404 esconde.
 */
export default async function GerencialNotFound() {
  const user = await getSession();
  const voltar = user ? firstAllowedHref(user.allowedSections) : "/gerencial";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-600">
        <Compass className="h-7 w-7" />
      </span>
      <h1 className="mt-4 text-xl font-bold tracking-tight text-ink">Página não encontrada</h1>
      <p className="mt-2 max-w-md text-sm text-muted">
        Esta página não existe ou não está disponível para o seu perfil. Se você chegou por um link
        antigo, ele pode ter mudado de lugar.
      </p>
      <Link
        href={voltar}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Voltar ao painel
      </Link>
      <p className="mt-3 text-xs text-muted">
        Precisa de acesso a esta área? Fale com um administrador.
      </p>
    </div>
  );
}
