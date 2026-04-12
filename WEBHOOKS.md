# Webhooks — Qarvon CRM

## Visão Geral

O CRM expõe 3 endpoints de webhook:

| Endpoint | Fonte | Verificação |
|----------|-------|-------------|
| `POST /api/webhooks/whatsapp` | Meta (WhatsApp) | HMAC-SHA256 com App Secret |
| `POST /api/webhooks/instagram` | Meta (Instagram) | HMAC-SHA256 com App Secret |
| `POST /api/webhooks/erp` | ERP Qarvon | HMAC-SHA256 com ERP_WEBHOOK_SECRET |

Todos respondem com `{ received: true }` imediatamente e processam de forma assíncrona.

---

## WhatsApp Cloud API

### Configuração no Meta

1. Acesse [developers.facebook.com](https://developers.facebook.com)
2. Crie/acesse seu App Meta
3. Adicione o produto **WhatsApp**
4. Em **Configuration > Webhooks**, configure:
   - Callback URL: `https://crm.qarvon.com/api/webhooks/whatsapp`
   - Verify Token: valor de `META_VERIFY_TOKEN` no seu `.env`
5. Assine os campos: `messages`, `message_status_updates`, `messaging_postbacks`

### Variáveis necessárias

```env
META_APP_ID=
META_APP_SECRET=
META_VERIFY_TOKEN=
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
```

### Eventos processados

| Evento | Ação no CRM |
|--------|-------------|
| `messages` (inbound) | Cria/atualiza Contact, Conversation, Message, Lead |
| `statuses` (sent/delivered/read/failed) | Atualiza `messages.status` |
| Referral com `ctwa_clid` | Captura attribution, enfileira Lead CAPI |

---

## Instagram Direct

### Configuração no Meta

1. No App Meta, adicione o produto **Instagram**
2. Em **Configuration > Webhooks**:
   - Callback URL: `https://crm.qarvon.com/api/webhooks/instagram`
   - Verify Token: valor de `INSTAGRAM_VERIFY_TOKEN`
3. Assine o campo: `messages`

### Variáveis necessárias

```env
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_VERIFY_TOKEN=
```

---

## ERP → CRM Webhook

O ERP envia eventos quando ocorrem vendas. O CRM consome e processa.

### Configuração no ERP

O ERP deve enviar requisições HMAC-assinadas para:
```
POST https://crm.qarvon.com/api/webhooks/erp
```

### Headers obrigatórios

```
Content-Type: application/json
X-Qarvon-Signature: sha256=<hmac_sha256_do_body>
```

**Cálculo do HMAC:**
```python
import hmac, hashlib
sig = hmac.new(
  ERP_WEBHOOK_SECRET.encode(),
  body.encode(),
  hashlib.sha256
).hexdigest()
header = f"sha256={sig}"
```

### Formato do Evento

```json
{
  "event_id": "sale_12345_unique_id",
  "event_type": "sale.created",
  "timestamp": "2026-04-12T14:00:00Z",
  "payload": {
    "sale_id": "sale_12345",
    "customer_phone": "5511999999999",
    "customer_email": "cliente@email.com",
    "customer_name": "João Silva",
    "erp_customer_id": "cust_abc",
    "total": 497.00,
    "currency": "BRL",
    "items": [
      {
        "product_id": "prod_1",
        "product_name": "Curso Online",
        "quantity": 1,
        "unit_price": 497.00,
        "total": 497.00
      }
    ],
    "created_at": "2026-04-12T14:00:00Z"
  }
}
```

### Tipos de evento suportados

| event_type | Ação |
|-----------|------|
| `sale.created` | Atualiza revenue do contato, move lead para Ganho, enfileira CAPI Purchase |
| `sale.updated` | Atualiza activity (sem mudar status) |
| `sale.refunded` | Subtrai revenue do contato, cria activity de estorno |

### Idempotência

O CRM usa `event_id` como chave de idempotência. Enviar o mesmo `event_id` duas vezes é seguro — o segundo será ignorado.

---

## Meta Conversions API (CRM → Meta)

O CRM (não o ERP) é responsável por enviar eventos para o Meta.

Eventos enviados:
- **Lead** — quando primeiro contato via WhatsApp com `ctwa_clid`
- **Purchase** — quando ERP confirma venda vinculada a lead

Os eventos são enfileirados na tabela `capi_queue.events` e enviados pelo worker `capi-flush-worker` a cada 5 minutos, com retry exponencial (até 5 tentativas).
