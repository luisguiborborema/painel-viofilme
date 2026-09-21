@AGENTS.md

# Regras deste repositório

## Git

**Repositório:** `https://github.com/luisguiborborema/painel-viofilme.git` (remote `origin`, já configurado)
**Conta neste computador:** `luisguiborborema`
**Branch de trabalho:** `main` — este projeto não usa feature branch.

### 1. Nunca empurrar sem ter puxado antes

```bash
git commit -m "..."            # 1. fecha a alteração localmente
git pull --rebase origin main  # 2. traz o que veio de fora
git push origin main           # 3. só então empurra
```

O pull vem **depois do commit e antes do push**, nessa ordem, porque
`git pull --rebase` recusa rodar com a árvore suja ("cannot pull with rebase:
you have unstaged changes"). Commitar primeiro é o que torna o pull possível.

Puxar antes de empurrar não é formalidade: o mesmo repositório é tocado de mais
de um lugar. Sem isso o push é recusado e, pior, um merge feito às pressas
depois pode desfazer trabalho que já estava lá.

`--rebase` mantém o histórico linear, que é como este repositório está hoje.

Se o rebase parar em conflito, resolva e siga com `git rebase --continue` — não
aborte para "resolver depois", porque o depois vira um merge às cegas.

### 2. Depois de uma alteração, commit + push no `main`

Toda alteração concluída termina em `main`, sem esperar o usuário pedir. Não
deixe trabalho pronto parado na árvore de trabalho.

**"Concluída" quer dizer verificada.** Rode os mesmos portões do CI antes de
empurrar — é o que o CI roda a cada push em `main`, e main vermelho bloqueia
todo mundo:

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Se algum falhar, conserte antes de empurrar. Não empurre no meio de uma edição
nem com teste quebrado.

Um commit por assunto: correção de bug que já existia não entra junto com a
funcionalidade nova. Mensagem no padrão do histórico — `tipo(escopo): o que
mudou, em português`, explicando a intenção e não o diff.

**Exceção:** segredo, `.env*`, dump de banco e dado de cliente nunca vão para
o commit. Na dúvida sobre um arquivo, pare e pergunte.

## Migrations do Supabase

Convenção definida em [docs/BANCO-DE-DADOS.md](docs/BANCO-DE-DADOS.md) — é ela
que vale:

- **Nome:** `NNNN_assunto.sql`, em `supabase/migrations/`. O número é sequencial
  e continua de onde o último parou, sem pular. São **aplicadas na ordem
  numérica**, no SQL Editor do Supabase ou por `supabase db push`.

- **Idempotentes, sempre.** A mesma migration precisa poder rodar duas vezes
  sem erro, porque na prática ela roda: `create table if not exists`,
  `alter table ... add column if not exists`, `create index if not exists`,
  `on conflict do nothing` e `drop policy if exists` antes de cada
  `create policy`.

- **RLS em toda tabela nova**, sem exceção: `alter table ... enable row level
  security` mais a policy de acesso. Tabela sem RLS no Supabase fica legível
  pela chave anônima — ou seja, pública.

- **Colunas novas com `default`** quando a tabela já tem linhas, senão a
  migration quebra no `not null`.

- **Cabeçalho comentado** dizendo *por que* a migration existe e o que ela
  resolve, como as anteriores fazem. O `create table` qualquer um lê no SQL; a
  razão, não.

- **Tabela nova precisa ser classificada no backup.** O teste
  `tests/backup.test.ts` lê as migrations e cobra: ou entra em
  `TABELAS_BACKUP`, ou em `FORA_DE_PROPOSITO` com a justificativa. Ele falha
  de propósito — tabela fora do backup só aparece no dia da restauração.

- **Quem roda a migration é o Gui**, no SQL Editor. O projeto Supabase da
  Viofilme não está no MCP conectado. Escreva a migration, deixe a página
  tolerante à ausência dela (avisando na tela) e avise que precisa rodar.
