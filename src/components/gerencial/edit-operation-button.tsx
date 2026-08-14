"use client";

/**
 * Dispara o evento que abre os modais de operação da ficha (Responsáveis /
 * Serviços & entregáveis / Briefing) hospedados no cabeçalho (ClientManageActions).
 * Assim o card "Contrato & referência" edita sem duplicar os editores.
 */
export function EditOperationButton({
  clientId,
  target,
  children,
  className,
}: {
  clientId: string;
  target: "brief" | "resp" | "ops";
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new CustomEvent("vio:client-edit", { detail: { clientId, target } }))
      }
      className={className}
    >
      {children}
    </button>
  );
}
