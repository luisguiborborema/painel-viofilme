# Assinatura da proposta com ZapSign

A proposta gerada a partir de um pacote pode ser assinada de dois jeitos:

| | Aceite na página (padrão) | ZapSign |
|---|---|---|
| O que registra | nome digitado, IP e data | assinatura com carimbo de tempo e trilha de auditoria |
| PDF assinado | não | sim, arquivado e baixável |
| Custo | zero | conforme o plano da ZapSign |

O aceite na página continua existindo para quem não quer gastar crédito. Cada
documento guarda em `provider` qual mecanismo vale para ele — sem isso, os dois
ficariam indistinguíveis na leitura, e o que se pode provar sobre cada um é bem
diferente.

## Configurar (uma vez)

### 0. Produção exige Plano de API

A ZapSign responde **HTTP 402** — *"É obrigatório contratar um Plano de API para
utilizá-la em modo produção"* — enquanto a conta não tiver um Plano de API. O
token sozinho não basta.

Para testar antes de contratar, use o **sandbox**: reproduz produção inteira,
não exige plano, e o que se assina lá **não tem validade jurídica**.

```
ZAPSIGN_SANDBOX = true
ZAPSIGN_TOKEN   = <token tirado de sandbox.app.zapsign.com.br>
```

O token do sandbox é **outro**, tirado de
`https://sandbox.app.zapsign.com.br/acesso/entrar` → Configurações →
Integrações → API. Usar o token de produção no sandbox (ou o contrário)
responde 401 sem explicar por quê. O webhook também precisa ser registrado no
painel do sandbox.

Para ir a produção: contrate o Plano de API, troque o token pelo de produção e
**remova** `ZAPSIGN_SANDBOX` (ou ponha `false`). O padrão é produção — o
ambiente sem validade jurídica nunca é assumido por omissão.

### 1. Token da API

No painel da ZapSign: **Configurações → Integrações → API** e copie o token.

Na Vercel (**Settings → Environment Variables**), em Production:

```
ZAPSIGN_TOKEN = <o token da ZapSign>
```

### 2. Segredo do webhook

A ZapSign **não assina** o corpo do webhook — não há HMAC. O que ela permite é
mandar headers definidos por nós. Então o segredo é nosso e viaja no header.

Gere um valor aleatório:

```bash
openssl rand -hex 32
```

Coloque o mesmo valor na Vercel:

```
ZAPSIGN_WEBHOOK_SECRET = <o valor gerado>
```

> Sem esta variável o webhook responde **503 e não processa nada**. É de
> propósito: aceitar um POST anônimo significaria deixar qualquer um marcar um
> documento como assinado, que é uma afirmação jurídica sobre uma pessoa.

Faça o redeploy para as variáveis valerem.

### 3. Registrar o webhook na ZapSign

**O painel da ZapSign não tem campo de header** — ele só pede tipo de evento e
URL. Há dois caminhos, e os dois funcionam:

**Pelo painel (mais simples):** ponha o segredo na própria URL.

```
https://www.viofilme.com.br/api/webhooks/zapsign?secret=SEU_ZAPSIGN_WEBHOOK_SECRET
```

Tipo de evento: **Todos (documentos)**. Vale saber que o segredo fica guardado
na configuração da ZapSign e pode aparecer em log de servidor — é um pouco mais
exposto que o header. Para trocar depois, é só editar o webhook e a variável.

**Pela API (header, mais protegido):**

```bash
curl -X POST https://api.zapsign.com.br/api/v1/user/company/webhook/ \
  -H "Authorization: Bearer $ZAPSIGN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.viofilme.com.br/api/webhooks/zapsign",
    "type": "",
    "headers": [
      { "name": "Authorization", "value": "Bearer SEU_ZAPSIGN_WEBHOOK_SECRET" }
    ]
  }'
```

`"type": ""` assina todos os eventos. O header precisa ser **exatamente** o
`ZAPSIGN_WEBHOOK_SECRET` configurado na Vercel.

Para conferir se o endpoint está de pé:

```bash
curl https://www.viofilme.com.br/api/webhooks/zapsign
# {"ok":true,"servico":"webhook ZapSign","configurado":true,"ambiente":"produção"}
```

`configurado: false` significa que a variável não chegou ao deploy.

## Usar

Em **Comercial › Listas › Produtos**, no cartão do pacote:

- **✈️** gera a proposta como link público com aceite na própria página.
- **✍️** envia para a ZapSign.

No envio, informe quem assina (nome e e-mail ou WhatsApp) e como a pessoa se
identifica. `Só desenhar/aceitar em tela` e `Token por e-mail` não consomem
crédito; SMS e WhatsApp consomem, e o custo aparece na própria lista.

O que acontece: o PDF da proposta é gerado com a marca da Viofilme, sobe para o
storage numa URL pública não adivinhável, e a ZapSign busca o arquivo de lá. A
pessoa recebe o link por e-mail/WhatsApp. Quando assina, o webhook atualiza o
documento e o cartão passa a mostrar **assinada** com link para o PDF assinado.

## Limites conhecidos

- O PDF fica numa URL pública (caminho não adivinhável, mas sem autenticação) —
  é o mesmo mecanismo que o envio de proposta por WhatsApp já usava. A ZapSign
  exige URL pública; a alternativa seria mandar o arquivo em base64.
- A ZapSign reenvia evento que falhou (configurável no painel: até 30 tentativas,
  com espera entre elas). Por isso o endpoint responde **200** para documento
  desconhecido — devolver erro faria a ZapSign insistir num evento que nunca
  vamos conseguir tratar.
- O contrato no *Lead Ganho* continua usando a Edge Function `zapsign-send`,
  que é outra casca e segue desligada. Só a **proposta** passa pelo fluxo acima.
