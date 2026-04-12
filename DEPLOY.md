# Deploy — Easypanel

## Serviços a criar no Easypanel

O CRM é composto por **2 serviços independentes**:

| Serviço | Dockerfile | Porta | Descrição |
|---------|-----------|-------|-----------|
| `qarvon-crm-web` | `Dockerfile` | 3000 | Next.js Web App |
| `qarvon-crm-worker` | `Dockerfile.worker` | — | Background Workers |

---

## Passo a Passo

### 1. Criar projeto no Easypanel

1. Acesse seu Easypanel
2. Clique em **New Project** → nome: `qarvon-crm`

---

### 2. Serviço: Web App

1. **New Service** → **App** → selecione **GitHub** (ou Docker Image)
2. Repositório: `jhanryw/crm`
3. Dockerfile: `Dockerfile`
4. Porta: `3000`
5. Domínio: `crm.qarvon.com`

**Build Arguments** (variáveis baked no build):
```
NEXT_PUBLIC_SUPABASE_URL=https://seu-supabase.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://crm.qarvon.com
```

**Environment Variables** (runtime):
```
NODE_ENV=production
SUPABASE_SERVICE_ROLE_KEY=eyJ...
META_APP_SECRET=...
META_VERIFY_TOKEN=...
INSTAGRAM_APP_SECRET=...
INSTAGRAM_VERIFY_TOKEN=...
ERP_BASE_URL=https://erp.qarvon.com
ERP_WEBHOOK_SECRET=...
ERP_API_KEY=...
```

**Health Check:**
```
Path: /api/health
Interval: 30s
```

---

### 3. Serviço: Worker

1. **New Service** → **App**
2. Repositório: `jhanryw/crm`
3. Dockerfile: `Dockerfile.worker`
4. Porta: nenhuma (sem HTTP)

**Environment Variables:**
```
NODE_ENV=production
NEXT_PUBLIC_SUPABASE_URL=https://seu-supabase.com
SUPABASE_SERVICE_ROLE_KEY=eyJ...
META_PIXEL_ID=...
META_CAPI_ACCESS_TOKEN=...
META_TEST_EVENT_CODE=     # deixar vazio em produção
WORKER_SCORING_INTERVAL_MS=900000
WORKER_CAPI_INTERVAL_MS=300000
WORKER_TEMP_INTERVAL_MS=3600000
WORKER_METRICS_INTERVAL_MS=3600000
```

---

### 4. Configurar Banco de Dados

O CRM usa o mesmo Supabase do ERP (schemas separados).

Execute as migrations no Supabase:

```bash
# Opção 1: Supabase CLI
supabase db push

# Opção 2: SQL Editor no Supabase Studio
# Execute cada arquivo em supabase/migrations/ na ordem numérica
```

---

### 5. Configurar Webhooks no Meta

**WhatsApp:**
- URL: `https://crm.qarvon.com/api/webhooks/whatsapp`
- Verify Token: `META_VERIFY_TOKEN`
- Campos: `messages`

**Instagram:**
- URL: `https://crm.qarvon.com/api/webhooks/instagram`
- Verify Token: `INSTAGRAM_VERIFY_TOKEN`
- Campos: `messages`

---

### 6. Configurar Webhook no ERP

No ERP, configure para enviar eventos para:
```
POST https://crm.qarvon.com/api/webhooks/erp
Header: X-Qarvon-Signature: sha256=<hmac>
```

Segredo compartilhado: `ERP_WEBHOOK_SECRET`

---

### 7. Criar primeiro workspace e usuário

1. Crie o usuário no Supabase Auth (Studio → Auth → Users → Invite)
2. Execute no SQL Editor do Supabase:

```sql
-- Criar workspace
INSERT INTO crm.workspaces (name, slug, plan)
VALUES ('Qarvon', 'qarvon', 'enterprise')
RETURNING id;

-- Adicionar usuário ao workspace (substitua os UUIDs)
INSERT INTO crm.workspace_members (workspace_id, user_id, role, display_name)
VALUES (
  '<workspace_id_gerado_acima>',
  '<user_id_do_supabase>',
  'owner',
  'Seu Nome'
);

-- Criar canal WhatsApp
INSERT INTO messaging.channels (workspace_id, type, name, phone_number_id, phone_number, waba_id, access_token)
VALUES (
  '<workspace_id>',
  'whatsapp',
  'WhatsApp Principal',
  '<phone_number_id>',
  '+5511999999999',
  '<waba_id>',
  '<access_token>'
);
```

---

## Certificado SSL

O Easypanel configura SSL automaticamente via Let's Encrypt quando você vincula um domínio.  
Aponte o DNS `crm.qarvon.com` para o IP do seu servidor antes de adicionar o domínio no Easypanel.

---

## Monitoramento

- **Health check**: `GET https://crm.qarvon.com/api/health`
- **Logs do worker**: via Easypanel Logs no serviço `qarvon-crm-worker`
- **Métricas**: Analytics dashboard no próprio CRM (`/analytics`)

---

## Rollback

No Easypanel, cada deploy gera uma imagem identificada por commit hash.  
Para rollback: **Deployments** → selecione versão anterior → **Redeploy**.
