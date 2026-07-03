import { redirect } from "next/navigation";

/** Resultados foi absorvida pela Gestão à Vista (lentes de performance). */
export default function GerencialResultados() {
  redirect("/gerencial/gestao-a-vista");
}
