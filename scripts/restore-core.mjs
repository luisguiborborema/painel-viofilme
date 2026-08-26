/**
 * Núcleo da restauração: em que ordem gravar as tabelas.
 *
 * Chave estrangeira exige ordem (cliente antes de cobrança), e a ordem exata
 * depende do schema. Manter a lista à mão significa vê-la envelhecer em
 * silêncio até o dia da restauração. Em vez disso: tenta todas, repete as que
 * falharam enquanto houver progresso, e para quando um passe inteiro não
 * conseguir gravar nada — aí o que sobrou é erro de verdade, não ordem.
 *
 * `gravar(tabela, linhas)` deve devolver `null` em sucesso ou a mensagem de erro.
 */
export async function restaurarEmPasses(tabelas, dados, gravar) {
  let pendentes = [...tabelas];
  const feitas = [];
  let errosDoPasse = [];
  let passes = 0;

  while (pendentes.length > 0) {
    passes++;
    const falharam = [];
    errosDoPasse = [];
    let progrediu = false;

    for (const tabela of pendentes) {
      const linhas = dados[tabela] ?? [];
      const erro = linhas.length === 0 ? null : await gravar(tabela, linhas);
      if (erro) {
        falharam.push(tabela);
        errosDoPasse.push({ tabela, erro });
      } else {
        feitas.push({ tabela, linhas: linhas.length });
        progrediu = true;
      }
    }

    pendentes = falharam;
    // Um passe inteiro sem gravar nada: insistir não vai resolver.
    if (!progrediu) break;
  }

  return { feitas, pendentes, erros: errosDoPasse, passes };
}
