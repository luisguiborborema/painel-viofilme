"use client";

import { useActionState, useEffect } from "react";
import { Building2, UserRound } from "lucide-react";
import { signIn, signInDemoAction, type SignInState } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

const initial: SignInState = { error: null };

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const [state, formAction, pending] = useActionState(signIn, initial);

  // Recarregamento real para o destino (documento limpo para o novo papel).
  useEffect(() => {
    if (state.redirectTo) window.location.assign(state.redirectTo);
  }, [state.redirectTo]);

  const enterDemo = async (role: "gerencial" | "cliente") => {
    const dest = await signInDemoAction(role);
    window.location.assign(dest);
  };

  return (
    <div className="w-full max-w-sm">
      <h2 className="text-2xl font-bold text-ink">Entrar no painel</h2>
      <p className="mt-1 text-sm text-muted">
        Acesse com suas credenciais Viofilme.
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label
            htmlFor="email"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            E-mail
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={demoMode ? "gerencial@viofilme.com.br" : ""}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="voce@empresa.com.br"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1.5 block text-sm font-medium text-ink"
          >
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            defaultValue={demoMode ? "viofilme" : ""}
            className="h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm text-ink outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            placeholder="••••••••"
          />
        </div>

        {state.error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="w-full"
          disabled={pending}
        >
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      {demoMode && (
        <div className="mt-6">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-xs uppercase tracking-wide text-muted">
              ou acesse a demonstração
            </span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => enterDemo("gerencial")}
            >
              <Building2 className="h-4 w-4" />
              Gerencial
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => enterDemo("cliente")}
            >
              <UserRound className="h-4 w-4" />
              Cliente
            </Button>
          </div>
          <p className="mt-3 text-center text-xs text-muted">
            Modo demonstração ativo (sem Supabase configurado).
          </p>
        </div>
      )}
    </div>
  );
}
