# Arquitetura — Qarvon CRM

## Princípio Fundamental

**O CRM e o ERP são projetos completamente separados.**

| | ERP | CRM |
|--|-----|-----|
| Repositório | `jhanryw/erp` | `jhanryw/crm` |
| URL | erp.qarvon.com | crm.qarvon.com |
| Deploy | Easypanel independente | Easypanel independente |
| Banco | Schema `public` (ERP) | Schemas: `crm`, `messaging`, `attribution`, `analytics`, `capi_queue` |
| Comunicação | — | Via API REST / Webhooks do ERP |

---

## Diagrama de Sistemas

```
┌─────────────────────────────────────────────────────────────┐
│                     SUPABASE (self-hosted)                  │
│  ┌────────────┐  ┌──────────────────────────────────────┐  │
│  │ ERP schema │  │           CRM schemas                │  │
│  │  (public)  │  │  crm · messaging · attribution       │  │
│  │            │  │  analytics · capi_queue              │  │
│  └────────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        ↑ API REST                    ↑ Supabase JS
        │                            │
┌───────────────┐         ┌─────────────────────┐
│  ERP          │──webhook→│  CRM                │
│  erp.qarvon   │         │  crm.qarvon.com      │
│  .com         │         │                      │
└───────────────┘         │  ┌──────────────┐   │
                          │  │ Next.js Web  │   │
        ┌─────────────────│──│ (App Router) │   │
        │                 │  └──────────────┘   │
        │ Cloud API        │  ┌──────────────┐   │
        │                 │  │ Workers       │   │
  ┌─────────────┐         │  │ scoring       │   │
  │ WhatsApp    │         │  │ capi-flush    │   │
  │ Instagram   │         │  │ metrics       │   │
  └─────────────┘         │  └──────────────┘   │
                          └─────────────────────┘
                                    │
                          ┌─────────────────────┐
                          │   Meta CAPI         │
                          │   Google Ads        │
                          └─────────────────────┘
```

---

## Fluxo de uma Mensagem Inbound

```
1. Usuário envia msg no WhatsApp
         ↓
2. Meta envia POST para /api/webhooks/whatsapp
         ↓
3. CRM verifica assinatura HMAC (Meta App Secret)
         ↓
4. CRM upserta Contact (por telefone)
         ↓
5. CRM upserta Conversation
         ↓
6. CRM cria Lead (se primeira mensagem) → stage=Novo Lead
         ↓
7. CRM salva Message na tabela messaging.messages
         ↓
8. Se ctwa_clid presente → encaminha Lead CAPI para meta (via fila)
         ↓
9. UI atualiza via Supabase Realtime (websocket)
```

---

## Fluxo de Venda (ERP → CRM)

```
1. ERP processa venda paga
         ↓
2. ERP envia POST para CRM /api/webhooks/erp
   Payload: { event_id, event_type: "sale.created", payload: {...} }
         ↓
3. CRM verifica HMAC (ERP_WEBHOOK_SECRET)
         ↓
4. CRM armazena evento (idempotência por event_id)
         ↓
5. CRM processa async:
   - Acha contato pelo telefone do cliente
   - Atualiza contact.total_revenue e purchase_count
   - Move lead para estágio "Ganho"
   - Cria lead_activity de tipo "purchase"
   - Enqueue Purchase event para Meta CAPI
         ↓
6. Worker capi-flush-worker envia para Meta em até 5 minutos
```

---

## Lead Scoring (0–100)

O score é recalculado a cada 15 minutos pelo `scoring-worker`.

| Fator | Pontos |
|-------|--------|
| Tem telefone | +10 |
| Tem email | +5 |
| Já comprou 1x | +20 |
| Já comprou 3+ vezes | +10 |
| Receita > R$500 | +10 |
| Receita > R$2000 | +10 |
| Msg recente (< 24h) | +15 |
| Msg recente (< 3d) | +10 |
| 10+ mensagens | +10 |
| Veio de campanha paga | +5 |
| Tem ctwa_clid | +10 |
| Avançou 50%+ no pipeline | +10 |
| Sem contato > 30 dias | -15 |
| Lead muito antigo (> 60d) | -10 |

**Temperatura por score:**
- 0–34 → Frio (cold)
- 35–54 → Morno (warm)
- 55–74 → Quente (hot)
- 75–100 → Em Chamas (burning)

---

## Segurança

- **RLS obrigatório** em todas as tabelas — usuários só veem dados do seu workspace
- **service_role** apenas no backend (workers, routes de webhook) — nunca exposto ao browser
- **HMAC-SHA256** em todos os webhooks (Meta, Instagram, ERP)
- **Idempotência** em webhooks do ERP via `event_id` único
- **Tokens de canal** armazenados criptografados (implementar em produção com Vault/KMS)

---

## Real-time

O inbox usa Supabase Realtime para atualizações sem polling:
- `messaging.conversations` — novas conversas e last_message
- `messaging.messages` — novas mensagens na conversa aberta

Os workers e routes de API usam o `service_role` client que bypassa RLS.
