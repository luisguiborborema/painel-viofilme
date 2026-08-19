import { redirect } from "next/navigation";

export const metadata = { title: "Campanhas" };


/** Campanhas foi absorvida pela Gestão à Vista (lentes de performance). */
export default function GerencialCampanhas() {
  redirect("/gerencial/gestao-a-vista");
}
