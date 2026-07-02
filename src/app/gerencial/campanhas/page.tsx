import { redirect } from "next/navigation";

/** Campanhas agora vive dentro da Gestão à Vista (aba interna). */
export default function GerencialCampanhas() {
  redirect("/gerencial/gestao-a-vista?tab=campanhas");
}
