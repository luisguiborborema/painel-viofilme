import { redirect } from "next/navigation";

/** Resultados agora vive dentro da Gestão à Vista (aba interna). */
export default function GerencialResultados() {
  redirect("/gerencial/gestao-a-vista?tab=resultados");
}
