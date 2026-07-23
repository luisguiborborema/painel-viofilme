import Link from "next/link";
import { Settings2 } from "lucide-react";

/**
 * Atalho contextual para a fonte única de configuração (§1 do spec).
 * NÃO configura no lugar — apenas navega para a seção certa, via âncora direta:
 * /gerencial/crm?tab=configuracoes#{section}.
 */
export function SettingsShortcut({
  section,
  label = "Configurar…",
  className = "",
}: {
  section: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link
      href={`/gerencial/crm?tab=configuracoes#${section}`}
      className={`inline-flex items-center gap-1 text-xs text-muted transition-colors hover:text-brand-600 ${className}`}
      title="Abrir nas Configurações"
    >
      <Settings2 className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}
