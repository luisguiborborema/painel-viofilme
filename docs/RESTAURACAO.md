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

O que também **não** está no arquivo: os **usuários** (ficam em `auth.users`,
área gerenciada pelo Supabase) e os **arquivos** enviados ao Storage.

O teste `tests/backup.test.ts` compara a lista de tabelas com as migrações e
falha se alguém criar tabela nova sem incluí-la — foi assim que se descobriu
que dez tabelas estavam faltando, entre elas toda a configuração financeira.

## Ensaio (faça uma vez, sem pressa)

1. Crie um projeto Supabase novo, vazio — o plano gratuito serve.
2. Rode todas as migrações de `supabase/migrations/` nele, em ordem.
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
