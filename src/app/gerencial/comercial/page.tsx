import { redirect } from "next/navigation";

export const metadata = { title: "Comercial" };


export default function ComercialIndex() {
  redirect("/gerencial/comercial/dashboard");
}
