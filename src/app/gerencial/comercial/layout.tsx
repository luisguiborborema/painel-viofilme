import { ComercialNav } from "@/components/crm/comercial-nav";

/**
 * Casca do módulo Comercial: uma régua de abas (object switcher estilo HubSpot)
 * sempre visível acima do conteúdo de todas as telas de /gerencial/comercial.
 */
export default function ComercialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ComercialNav />
      {children}
    </div>
  );
}
