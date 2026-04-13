# Database — Qarvon CRM

O CRM usa o **mesmo banco Supabase** que o ERP, mas em **schemas separados**.  
Nunca acessa tabelas do schema `public` (ERP) diretamente.

---

## Schemas

| Schema | Responsabilidade |
|--------|-----------------|
| `crm` | Workspaces, Contacts, Leads, Pipeline, Activities, Tasks, Notes, Alerts, Contact Merges |
| `messaging` | Channels, Conversations, Messages, Templates, Quick Replies |
| `attribution` | Ad Accounts, Campaigns, Creatives, Touch Events |
| `analytics` | Daily Metrics, Campaign Revenue, Agent Daily Metrics, Creative Daily Metrics |
| `capi_queue` | Fila de eventos CAPI (Meta/Google), Event Logs |

---

## Schema `crm`

### `crm.workspaces`
Organização/empresa que usa o CRM.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| id | UUID PK | Identificador |
| name | TEXT | Nome da empresa |
| slug | TEXT UNIQUE | Slug único |
| plan | TEXT | starter \| growth \| enterprise |
| settings | JSONB | Configurações (timezone, horário comercial, etc) |

### `crm.workspace_members`
Membros da equipe com seus papéis.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| user_id | UUID | FK → auth.users |
| workspace_id | UUID | FK → crm.workspaces |
| role | TEXT | owner \| admin \| manager \| agent |

### `crm.contacts`
Contatos/clientes únicos por workspace.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| phone | TEXT | E.164 (+5511...) |
| whatsapp_id | TEXT | Número sem + |
| instagram_id | TEXT | Instagram user ID |
| erp_customer_id | TEXT | ID do cliente no ERP (referência solta) |
| total_revenue | NUMERIC | Receita total acumulada |
| purchase_count | INT | Número de compras |

### `crm.leads`
Lead no pipeline (pode haver múltiplos por contato).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| score | INT (0-100) | Score calculado pelo scoring engine |
| temperature | TEXT | cold \| warm \| hot \| burning |
| ctwa_clid | TEXT | Click ID de anúncio WhatsApp |
| source | TEXT | whatsapp \| instagram \| paid \| organic |
| status | TEXT | open \| won \| lost \| archived |

### `crm.erp_sale_events`
Eventos recebidos do ERP (para idempotência e auditoria).

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| event_id | TEXT UNIQUE | ID de idempotência do ERP |
| event_type | TEXT | sale.created \| sale.updated \| sale.refunded |
| payload | JSONB | Payload completo do evento |
| processed | BOOLEAN | Já foi processado? |

---

## Schema `messaging`

### `messaging.channels`
Número de WhatsApp ou conta do Instagram vinculada.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| type | TEXT | whatsapp \| instagram |
| phone_number_id | TEXT | Meta phone_number_id |
| instagram_account_id | TEXT | Page/Account ID |
| access_token | TEXT | Token de acesso (encriptar em prod) |

### `messaging.conversations`
Thread de conversa entre contato e canal.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| external_id | TEXT | Phone number (WA) ou sender ID (IG) |
| status | TEXT | open \| pending \| resolved \| archived |
| ctwa_clid | TEXT | Click ID capturado na primeira mensagem |

### `messaging.messages`
Mensagens individuais.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| direction | TEXT | inbound \| outbound |
| type | TEXT | text \| image \| audio \| video \| document \| template |
| external_id | TEXT | wamid (WhatsApp Message ID) |
| status | TEXT | queued \| sent \| delivered \| read \| failed |
| ctwa_clid | TEXT | Presente apenas na primeira mensagem de ad |

---

## Schema `attribution`

### `attribution.campaigns`
Campanhas de ads (Meta, Google, etc).

### `attribution.creatives`
Criativos/conjuntos de anúncios dentro de uma campanha.

### `attribution.touch_events`
Todos os touchpoints que podem ser atribuídos a leads.
Usado para enviar eventos ao Meta CAPI.

---

## Schema `capi_queue`

### `capi_queue.events`
Fila persistente de eventos CAPI.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| platform | TEXT | meta \| google |
| event_name | TEXT | Purchase \| Lead \| InitiateCheckout |
| event_id | TEXT | Chave de deduplicação por plataforma |
| status | TEXT | pending \| sent \| failed \| skipped |
| attempts | INT | Tentativas de envio (máx 5) |
| send_after | TIMESTAMPTZ | Backoff exponencial em erros |

---

## RLS (Row Level Security)

Todas as tabelas têm RLS habilitado.

- **Usuários autenticados** só veem dados dos seus workspaces
- **service_role** (workers, webhook routes) bypassa RLS
- `capi_queue.events` só acessível via service_role

A função `crm.get_user_workspace_ids()` é usada em todas as políticas para determinar quais workspaces o usuário pode acessar.

---

## Migrations

Arquivos em `supabase/migrations/`:

| Arquivo | Conteúdo |
|---------|---------|
| `001_create_schemas.sql` | Criação dos schemas e trigger `set_updated_at` |
| `002_crm_schema.sql` | Workspaces, Members, Contacts, Leads, Activities, ERP Events |
| `003_messaging_schema.sql` | Channels, Conversations, Messages, Templates, Quick Replies |
| `004_attribution_schema.sql` | Ad Accounts, Campaigns, Creatives, Touch Events |
| `005_analytics_capi_schema.sql` | Daily Metrics, Campaign Revenue, CAPI Queue |
| `006_rls_policies.sql` | Todas as políticas de RLS |
| `007_seed_pipeline_stages.sql` | Estágios padrão por workspace |
| `008_fix_members_rls.sql` | Correção RLS workspace_members |
| `009_grant_table_permissions.sql` | Permissões por schema para authenticated e service_role |
| `010_crm_tasks.sql` | Tarefas por lead (`crm.tasks`) |
| `011_crm_lead_notes.sql` | Notas por lead (`crm.lead_notes`) |
| `012_crm_alerts.sql` | Alertas de temperatura (`crm.alerts`) |
| `013_analytics_extended.sql` | `analytics.agent_daily_metrics`, `analytics.creative_daily_metrics` |
| `014_capi_event_logs.sql` | `capi_queue.event_logs` — audit trail de tentativas |
| `015_contact_merges.sql` | `crm.contact_merges` — rastreio de merges de contatos |
