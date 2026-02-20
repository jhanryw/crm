# QARVON CRM - SPECS

## 1. Arquitetura

Frontend:
- Next.js
- Tailwind
- React Query

Backend:
- Supabase (Postgres)
- Edge Functions
- Realtime

Auth:
- Logto

Email:
- Postal SMTP
- Listmonk API

---

## 2. Banco de Dados

### Tabela: organizations
id
name
created_at

### users
id
organization_id
role (admin, gerente, vendedor)
email
logto_id

### inbox_conversations
id
organization_id
channel (whatsapp, instagram)
contact_id
assigned_to
status
created_at

### messages
id
conversation_id
direction (in, out)
body
campaign_id
created_at

### leads
id
organization_id
source
campaign_id
assigned_to
stage_id
value
created_at

### stages
id
organization_id
name
order_index
probability

### campaigns
id
organization_id
name
channel
meta_campaign_id
google_campaign_id
tracking_code

### deals_history
id
lead_id
old_stage
new_stage
moved_at

### webhooks
id
organization_id
origin
token
active

### response_times
id
conversation_id
first_response_seconds

---

## 3. Atribuição Sem UTM

Método híbrido:

1. Cada campanha gera:
   - tracking_code único
   - deep link:
     wa.me/NUMBER?text=Olá%20{{tracking_code}}

2. Ao receber mensagem:
   - Regex identifica tracking_code
   - Associa lead à campaign_id

3. Alternativa:
   - Número WhatsApp dedicado por campanha

4. Fallback:
   - Matching via Meta Webhook click_ref

---

## 4. Cálculo de Métricas

### Pipeline Total
SUM(leads.value WHERE stage != closed_lost)

### Conversão por Etapa
(leads in stage X+1 / leads in stage X)

### SLA
timestamp(first outbound) - timestamp(first inbound)

### ROI
(receita atribuída / investimento campanha)

---

## 5. Eventos para Pixel

Ao mover lead para:
- qualified
- closed_won
- closed_lost

Disparar:
- Facebook Conversions API
- Google Conversion API

Payload:
- email (hashed)
- phone (hashed)
- value
- campaign_id

---

## 6. Segurança

- RLS no Supabase
- organization_id obrigatório em todas tabelas
- RBAC via Logto

---

## 7. Inbox

Webhook único recebe:
- WhatsApp
- Instagram

Função:
1. Verifica contato
2. Cria lead se não existir
3. Atualiza conversa
4. Dispara realtime

---

## 8. Distribuição Automática

Modo:
- Round robin
- Manual
- Por campanha

---

## 9. Escalabilidade

- Indexação por organization_id
- Particionamento por data futura
- Event queue simples para processamentos async

---

## 10. Roadmap Futuro

- IA para priorização de leads
- Score automático
- Sugestão de follow-up
- Integração ERP
- Previsão de receita
