import { redirect } from "next/navigation";

// A tela do cliente foi dividida em abas-rota (ver layout.tsx). A raiz
// redireciona para a primeira aba (Resumo).
export default async function RaioXCliente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/gerencial/clientes/${id}/resumo`);
}
