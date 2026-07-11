/**
 * Fecha o modal ao navegar para qualquer outra rota do CRM (ex.: abrir a
 * empresa/contato a partir do detalhe). Sem isto, o slot manteria o modal
 * visível sobre a nova página numa navegação client-side.
 */
export default function CatchAll() {
  return null;
}
