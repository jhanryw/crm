# Runbook - Antigravity CRM

## Environment Setup
Required Env Vars:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...

# Authentication
LOGTO_ENDPOINT=...
LOGTO_APP_ID=...
LOGTO_APP_SECRET=...

# Attribution & Measurement
WA_TRACKING_REGEX=CAMP-[A-Z0-9]+
FEATURE_CONVERSIONS=true
```

## Testing Manually

### 1. Mock Inbox (with Attribution)
Simulate an incoming WhatsApp message with tracking code.

```bash
curl -X POST http://localhost:3000/api/inbox/mock \
  -H "Content-Type: application/json" \
  -d '{
    "contact": "5511999999999",
    "channel": "whatsapp",
    "message": "Olá, vi o anúncio e quero comprar. CAMP-SUMMER2024"
  }'
```
Expected: Message cleaned ("Olá, vi o anúncio..."), Lead created, Campaign attributed.

### 2. Lead Webhook
Create a lead directly from external source.

```bash
curl -X POST http://localhost:3000/api/webhooks/leads/dev_token_123 \
  -H "Content-Type: application/json" \
  -d '{
    "contact_name": "John Doe",
    "contact_email": "john@example.com",
    "source": "landing_page",
    "campaign_code": "CAMP-SUMMER2024",
    "value": 1500.00
  }'
```

### 3. Check Health
```bash
curl http://localhost:3000/api/health
```

## Internal Events
Events are logged to `event_log` table.
If `FEATURE_CONVERSIONS=true`, `lead_created` and `stage_changed` trigger (stubbed) async calls to Facebook CAPI and GA4.
