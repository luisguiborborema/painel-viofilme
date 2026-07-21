import { getSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico TEMPORÁRIO: chama o getSession() REAL (mesma função dos layouts,
 * em contexto de server component) e mostra o que ele retorna. Assim vemos se o
 * layout gerencial recebe role='gerencial' ou não. Remover depois.
 */
export default async function DebugSession() {
  const user = await getSession();
  return (
    <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13 }}>
      <h1 style={{ fontWeight: 700, marginBottom: 12 }}>getSession() no server component</h1>
      <pre style={{ whiteSpace: "pre-wrap", background: "#f4f4f5", padding: 16, borderRadius: 8 }}>
        {JSON.stringify(
          user
            ? { role: user.role, id: user.id, email: user.email, clientId: user.clientId, allowedSections: user.allowedSections }
            : null,
          null,
          2,
        )}
      </pre>
    </div>
  );
}
