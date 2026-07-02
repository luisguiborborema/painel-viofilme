"use client";

import { useEffect, useState } from "react";
import { Loader2, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DefinirSenha() {
  const [phase, setPhase] = useState<"loading" | "ready" | "error" | "done">(
    "loading",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const supabase = createClient();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        }
        const { data } = await supabase.auth.getSession();
        setPhase(data.session ? "ready" : "error");
      } catch {
        setPhase("error");
      }
    }
    init();
  }, []);

  async function submit() {
    if (password.length < 6) return;
    setBusy(true);
    setErr(null);
    const { error } = await createClient().auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setPhase("done");
    setTimeout(() => window.location.assign("/"), 1400);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-6">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500/10 text-brand-300">
          <LockKeyhole className="h-6 w-6" />
        </span>

        {phase === "loading" && (
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Validando o link…
          </p>
        )}

        {phase === "error" && (
          <>
            <h1 className="text-lg font-bold text-ink">Link inválido ou expirado</h1>
            <p className="mt-1 text-sm text-muted">
              Solicite um novo convite/redefinição à sua equipe.
            </p>
            <a
              href="/login"
              className="mt-4 inline-block text-sm font-medium text-brand-300 hover:text-brand-200"
            >
              Ir para o login
            </a>
          </>
        )}

        {phase === "ready" && (
          <>
            <h1 className="text-lg font-bold text-ink">Defina sua senha</h1>
            <p className="mt-1 text-sm text-muted">
              Crie uma senha para acessar o Painel Viofilme.
            </p>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="nova senha (mín. 6)"
              className="mt-4 h-11 w-full rounded-xl border border-line bg-canvas px-3.5 text-sm text-ink outline-none focus:border-brand-400"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            {err && <p className="mt-2 text-xs text-rose-400">{err}</p>}
            <button
              onClick={submit}
              disabled={busy || password.length < 6}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Definir senha e entrar
            </button>
          </>
        )}

        {phase === "done" && (
          <>
            <h1 className="text-lg font-bold text-ink">Senha definida! 🎉</h1>
            <p className="mt-1 text-sm text-muted">Entrando no painel…</p>
          </>
        )}
      </div>
    </div>
  );
}
