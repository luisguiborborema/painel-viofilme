import { LogoHorizontal } from "@/components/brand/logo";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LoginPage() {
  const demoMode = !isSupabaseConfigured();

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Painel de marca */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-700 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full"
          style={{ background: "radial-gradient(closest-side, #e9fc8933, transparent)" }}
        />
        <LogoHorizontal className="h-7 text-white" />
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">
            Make it happen.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Acompanhe campanhas, conteúdo e resultados de Instagram e Facebook —
            tudo em um só lugar, com a clareza que a Viofilme entrega.
          </p>
          <div className="mt-8 flex gap-8">
            <div>
              <p className="text-2xl font-bold text-lime">+180</p>
              <p className="text-xs text-white/60">projetos entregues</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-lime">4 anos</p>
              <p className="text-xs text-white/60">no mercado</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-lime">3 áreas</p>
              <p className="text-xs text-white/60">integradas por cliente</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40">
          © {new Date().getUTCFullYear()} Viofilme · viofilme.com.br
        </p>
      </div>

      {/* Formulário */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <LogoHorizontal className="h-7 text-brand-700" />
          </div>
          <LoginForm demoMode={demoMode} />
        </div>
      </div>
    </div>
  );
}
