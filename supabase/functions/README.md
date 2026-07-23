# Edge Functions — integrações externas (casca + placeholder)

Decisão-mãe: **toda chamada externa sai de Edge Function com a credencial como
secret no Supabase — nunca no cliente.** Cada função nasce como **casca**: fica
DESLIGADA por uma flag de ambiente e responde `501 { enabled: false }` (o app
cai no modo manual). Basta configurar os secrets e virar a flag para `true` que
ela passa a funcionar — sem tocar no código do app.

## Funções

| Função | O que faz | Flag | Secrets |
|---|---|---|---|
| `vioflux-publish` | Publica post no Instagram/Facebook (VioFlux) | `VIOFLUX_PUBLISH_ENABLED` | `META_SYSTEM_USER_TOKEN` |
| `zapsign-send` | Envia contrato p/ assinatura no **Lead Ganho** | `ZAPSIGN_ENABLED` | `ZAPSIGN_TOKEN`, `ZAPSIGN_TEMPLATE_ID` |
| `instagram-webhook` | Recebe DMs do Instagram → inbox | `INSTAGRAM_ENABLED` | `META_VERIFY_TOKEN`, `META_SYSTEM_USER_TOKEN` |
| `instagram-send` | Envia DM do Instagram (resposta) | `INSTAGRAM_ENABLED` | `META_SYSTEM_USER_TOKEN`, `IG_BUSINESS_ID` |
| `email-inbound` | Recebe e-mail (provedor inbound) → inbox | `EMAIL_ENABLED` | `EMAIL_INBOUND_SECRET` |
| `email-send` | Envia e-mail (resposta) | `EMAIL_ENABLED` | `EMAIL_API_KEY`, `EMAIL_FROM` |

> WhatsApp já é **real** (Uazapi) via rotas Next + webhook `/api/webhooks/uazapi`
> — não é Edge Function. Google Calendar é integrado no app (`src/lib/google/`).
> `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente nas
> functions (use-os para persistir no banco quando ligar in-bound de IG/e-mail).

## Ligar uma integração

1. **Secrets** — Dashboard → Project Settings → Edge Functions → Secrets
   (ou `supabase secrets set ZAPSIGN_TOKEN=... ZAPSIGN_ENABLED=true`).
2. **Deploy** — `supabase functions deploy <nome>`.
3. **Webhooks** (in-bound) — aponte o webhook do provedor (Meta / provedor de
   e-mail) para a URL da função. IG e e-mail-inbound validam um token/secret.
4. **App** — o chamador troca a resposta `501 { enabled:false }` (manual) pela
   real automaticamente; nenhuma mudança de código é necessária no front.

## Onde cada uma é chamada (quando ligar)

- **zapsign-send** → no gatilho *Lead Ganho* (após criar o cliente), gravando a
  URL de assinatura em `deals.zapsign_url` / `properties.n_zapsign`.
- **instagram-webhook / email-inbound** → criam conversa (`channel` respectivo)
  e casam com o lead por indício (ver spec Comunicações §3/§8:
  `conversations`, `messages`, `conversation_links`).
- **instagram-send / email-send** → resposta do atendente no inbox unificado.
