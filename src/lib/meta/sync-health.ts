/**
 * Quando avisar que a sincronização com o Meta parou.
 *
 * Regras puras, separadas do acesso ao banco, porque a decisão é sutil: avisar
 * cedo demais vira ruído que a equipe aprende a ignorar; avisar tarde demais é
 * o cliente descobrindo antes da agência.
 */

/** Uma falha pode ser instabilidade da API. Duas seguidas já é problema. */
export const FALHAS_PARA_AVISAR = 2;

/** Enquanto ninguém arruma, repete o aviso a cada 3 dias — não todo dia. */
export const DIAS_ENTRE_AVISOS = 3;

export type EstadoConexao = {
  consecutiveFailures: number;
  alertedAt: string | null;
};

/**
 * Decide se esta execução deve gerar aviso.
 *
 * `falhouAgora` é o resultado da sincronização que acabou de rodar.
 */
export function deveAvisar(
  estado: EstadoConexao,
  falhouAgora: boolean,
  agora = new Date(),
): boolean {
  if (!falhouAgora) return false;
  const falhas = Math.max(0, Number(estado.consecutiveFailures) || 0) + 1;
  if (falhas < FALHAS_PARA_AVISAR) return false;

  if (!estado.alertedAt) return true;
  const desde = agora.getTime() - new Date(estado.alertedAt).getTime();
  return desde >= DIAS_ENTRE_AVISOS * 86_400_000;
}

/** Como fica o registro depois desta execução. */
export function proximoEstado(
  estado: EstadoConexao,
  falhouAgora: boolean,
  erro: string | null,
  avisou: boolean,
  agora = new Date(),
): { consecutive_failures: number; last_error: string | null; last_synced_at: string | null; alerted_at: string | null } {
  if (!falhouAgora) {
    // Sucesso limpa tudo: o próximo problema começa a contagem do zero, e o
    // aviso volta a ser imediato quando reincidir.
    return {
      consecutive_failures: 0,
      last_error: null,
      last_synced_at: agora.toISOString(),
      alerted_at: null,
    };
  }
  return {
    consecutive_failures: (Number(estado.consecutiveFailures) || 0) + 1,
    last_error: (erro ?? "erro desconhecido").slice(0, 500),
    // Não atualiza last_synced_at: ele marca a última vez que os números vieram.
    last_synced_at: null,
    alerted_at: avisou ? agora.toISOString() : estado.alertedAt,
  };
}

/** Texto do aviso — precisa dizer o que fazer, não só que quebrou. */
export function mensagemDeAviso(cliente: string, falhas: number, erro: string): string {
  const quando = falhas === FALHAS_PARA_AVISAR ? "nas duas últimas execuções" : `nas últimas ${falhas} execuções`;
  return (
    `A sincronização do Meta para ${cliente} falhou ${quando}. ` +
    `Os números do relatório estão parados desde então.\n\n` +
    `Erro: ${erro.slice(0, 200)}\n\n` +
    `Normalmente é token expirado — reconecte em Integrações.`
  );
}
