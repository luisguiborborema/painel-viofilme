import { redirect } from "next/navigation";

/** Campanhas foi absorvida pela Gestão à Vista (lentes de performance). */
export default function GerencialCampanhas() {
  redirect("/gerencial/gestao-a-vista");
}
