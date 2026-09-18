# Restauração do backup

O painel exporta o banco todo dia para o Google Drive, na pasta **Backups do
Painel**, em `painel-AAAA-MM-DD.json.gz` (retenção de 30 dias).

Este documento é o procedimento para trazer esses dados de volta. Leia antes de
precisar — o dia em que você precisar não é o dia de descobrir como funciona.

> **Um backup nunca restaurado é hipótese, não backup.** Faça o ensaio abaixo
> uma vez, num projeto separado. Leva vinte minutos e é a única forma de saber
> que funciona.

## O que o backup contém

Todas as tabelas de dados, incluindo a configuração financeira (contas,
categorias, régua de cobrança, orçamentos, conciliação). Ficam **de fora**, de
propósito:

- `api_logs` e `wa_webhook_log` — diagnóstico, com purga própria;
- `notifications` — avisos efêmeros da sineta;
- **tokens de Google e Meta** — vêm redigidos. Reconectar é um clique cada.
- **hash das chaves de API** — vem redigido. Depois de restaurar, emita chaves
  novas em Conta → Chaves de API; as antigas não voltam a funcionar.

O que também **não** está no arquivo: os **usuários** (ficam em `auth.users`,
área gerenciada pelo Supabase) e os **arquivos** enviados ao Storage.

O teste `tests/backup.test.ts` compara a lista de tabelas com as migrações e
falha se alguém criar tabela nova sem incluí-la — foi assim que se descobriu
que dez tabelas estavam faltando, entre elas toda a configuração financeira.

## Antes de qualquer coisa: o arquivo presta?

Metade do ensaio não precisa de banco nenhum. Baixe o backup mais recente do
Drive e rode:

```bash
node scripts/verificar-backup.mjs painel-2026-09-11.json.gz
```

Em segundos ele responde: as tabelas esperadas estão lá? Os tokens saíram
redigidos? Toda linha tem `id` (sem isso o restore a ignora)? O arquivo é
recente — ou o backup diário parou de rodar sem ninguém notar? Alguma tabela
bateu no teto de 50.000 linhas e foi cortada?

Vale rodar de vez em quando, não só antes do ensaio. É o único jeito de
descobrir que o backup parou **antes** de precisar dele.

O verificador foi exercitado contra arquivos estragados de propósito e pega:
token de integração que saiu **em claro** em vez de redigido, linha sem `id`
(que o restore ignoraria em silêncio), arquivo velho demais, tabela que bateu
no teto de 50.000 linhas e tabelas faltando. Não é checagem decorativa.

### O backup diário rodou mesmo?

O cron passa por `withApiLog`, então cada execução deixa registro. Em
**Conta → Logs de API** (só admin), filtre pela origem `cron:backup`:

```
/gerencial/logs?source=cron:backup&days=30
```

Trinta dias sem linha nenhuma ali significa que o backup parou — e o arquivo
mais recente no Drive é de antes disso. Esta é a checagem de dois cliques que
vale fazer no primeiro dia útil do mês.

## Ensaio completo (faça uma vez, sem pressa)

1. Crie um projeto Supabase novo, vazio — o plano gratuito serve.
2. Gere o pacote de migrações e cole no SQL Editor do projeto novo:

   ```bash
   node scripts/gerar-bundle-migracoes.mjs
   # ou, se o editor engasgar com o arquivo inteiro:
   node scripts/gerar-bundle-migracoes.mjs --partes
   ```

   São 140 arquivos juntados na ordem certa. Aplicar um a um é o passo que faz
   este ensaio nunca acontecer.

3. Baixe o backup mais recente do Drive.
4. Crie um `.env.restore` apontando para o projeto NOVO:

   ```
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_SERVICE_ROLE=eyJ...
   ```

5. Simule primeiro — não escreve nada:

   ```bash
   node scripts/restaurar-backup.mjs painel-2026-08-26.json.gz --dry-run
   ```

   Confira a data do backup, o número de tabelas e o destino.

6. Restaure de verdade:

   ```bash
   node scripts/restaurar-backup.mjs painel-2026-08-26.json.gz \
     --destino=.env.restore --confirmo
   ```

7. Aponte o painel para o projeto novo (`NEXT_PUBLIC_SUPABASE_URL` e chaves) e
   confira: clientes, contas a receber, DRE de um mês fechado.

Anote quanto tempo levou. Esse número é o seu tempo real de recuperação.

## Como o script se comporta

- **Nunca apaga.** Grava com `upsert` por `id`: rodar duas vezes dá o mesmo
  resultado, e linha que existe no destino e não no backup fica onde está.
- **Descobre a ordem sozinho.** Chave estrangeira exige ordem (cliente antes de
  cobrança). Em vez de uma lista fixa que envelhece, ele tenta todas as tabelas
  e repete as que falharam enquanto houver progresso. Um passe inteiro sem
  gravar nada significa erro real, e ele para e mostra qual foi.
- **Sem `--confirmo` é sempre simulação.**

Opções: `--tabelas=a,b` restaura só essas; `--pular=a,b` deixa essas de fora.

## Depois de restaurar

1. **Reconecte Google e Meta** — os tokens vieram redigidos.
2. **Recrie os usuários.** Eles não estão no backup; convide de novo pelo painel.
   Os perfis (`profiles`) voltam, mas só passam a valer quando o usuário
   correspondente existir em `auth.users` com o mesmo id.
3. **Confira o Storage** se houver anexos e documentos — arquivo não é backup de
   banco.
4. Refaça as variáveis de ambiente na Vercel se o projeto Supabase mudou.

## Limites conhecidos

- **50.000 linhas por tabela.** Acima disso o backup corta. Hoje está longe;
  quando `payments` ou `crm_leads` se aproximarem, aumente `MAX_LINHAS_POR_TABELA`
  em `src/lib/data/backup.ts`.
- **Uma cópia por dia, 30 dias.** Perda entre o último backup e o incidente é
  perda real — no pior caso, quase 24 horas de trabalho.
- **Sem backup gerenciado do Supabase** no plano atual: não há restauração a um
  ponto no tempo. Este arquivo é o plano inteiro.
