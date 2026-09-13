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

Pelo painel da ZapSign, ou por esta chamada:

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
# {"ok":true,"servico":"webhook ZapSign","configurado":true}
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
- A ZapSign não reenvia evento indefinidamente. Se o webhook estiver fora do ar
  na hora da assinatura, o documento fica como "aguardando" até alguém reenviar
  ou conferir no painel da ZapSign.
- O contrato no *Lead Ganho* continua usando a Edge Function `zapsign-send`,
  que é outra casca e segue desligada. Só a **proposta** passa pelo fluxo acima.
