import { redirect } from "next/navigation";

export const metadata = { title: "Resultados" };


/** Resultados foi absorvida pela Gestão à Vista (lentes de performance). */
export default function GerencialResultados() {
  redirect("/gerencial/gestao-a-vista");
}
