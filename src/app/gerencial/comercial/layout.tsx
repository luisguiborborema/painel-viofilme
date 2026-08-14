/**
 * Casca do módulo Comercial: só aplica o skin visual HubSpot (.hs-crm) a todas
 * as telas de /gerencial/comercial. A navegação fica no menu lateral global.
 */
export default function ComercialLayout({ children }: { children: React.ReactNode }) {
  return <div className="hs-crm">{children}</div>;
}
