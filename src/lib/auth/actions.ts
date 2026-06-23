"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authenticateDemo, DEMO_COOKIE, DEMO_USERS } from "./demo";
import { homeForRole } from "./routes";

export type SignInState = { error: string | null };

/** Login por e-mail/senha (Supabase) ou credenciais demo. */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Informe e-mail e senha." };
  }

  let role: "gerencial" | "cliente" = "cliente";

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      return { error: "E-mail ou senha inválidos." };
    }
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user?.id ?? "")
      .single();
    role = (profile?.role as typeof role) ?? "cliente";
  } else {
    const user = authenticateDemo(email, password);
    if (!user) {
      return { error: "E-mail ou senha inválidos. (Modo demo)" };
    }
    const store = await cookies();
    store.set(DEMO_COOKIE, JSON.stringify(user), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    role = user.role;
  }

  redirect(homeForRole(role));
}

/** Atalho do modo demo: entra direto como gerencial ou cliente. */
export async function signInDemo(role: "gerencial" | "cliente") {
  const email =
    role === "gerencial"
      ? "gerencial@viofilme.com.br"
      : "cliente@viofilme.com.br";
  const user = DEMO_USERS[email].user;
  const store = await cookies();
  store.set(DEMO_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(homeForRole(role));
}

/** Encerra a sessão (Supabase + cookie demo). */
export async function signOut() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  const store = await cookies();
  store.delete(DEMO_COOKIE);
  redirect("/login");
}
