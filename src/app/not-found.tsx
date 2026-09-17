import Link from "next/link";
import { LogoHorizontal } from "@/components/brand/logo";

export const metadata = { title: "Página não encontrada" };

/**
 * 404 da aplicação inteira — cobre qualquer URL que não casa com uma rota.
 *
 * Antes disto, o app caía na tela padrão do Next ("404 — This page could not be
 * found"), em inglês e sem marca. Era o que o cliente via ao abrir um link de
 * proposta com o token errado — um caractere a mais colado no fim já bastava.
 * Numa página que vai para cliente, isso parece sistema quebrado.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-5 text-center">
      <LogoHorizontal className="h-7 text-ink" />
      <div>
        <p className="text-5xl font-bold tracking-tight text-ink">404</p>
        <h1 className="mt-2 text-lg font-semibold text-ink">Página não encontrada</h1>
        <p className="mt-2 max-w-sm text-sm text-muted">
          O endereço não existe ou saiu do ar. Se você recebeu este link de alguém da Viofilme,
          confira se ele foi copiado por inteiro.
        </p>
      </div>
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
      >
        Ir para o início
      </Link>
    </main>
  );
}
