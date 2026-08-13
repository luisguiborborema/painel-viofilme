/**
 * Layout do CRM com um slot paralelo `@modal`. O slot renderiza o detalhe do
 * negócio como MODAL sobre o board (rota interceptada), preservando a URL
 * compartilhável /gerencial/crm/[id] — refresh/deep-link abrem a página cheia.
 */
export default function CrmLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <div className="hs-crm">
      {children}
      {modal}
    </div>
  );
}
