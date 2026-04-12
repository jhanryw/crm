# Qarvon CRM

CRM Omnichannel de alto nível para a Qarvon.

**URL de produção:** https://crm.qarvon.com  
**Repositório:** independente do ERP (`github.com/jhanryw/crm`)  
**ERP (separado):** https://erp.qarvon.com

---

## O que é

- **Inbox unificada** — WhatsApp (Cloud API multi-número) + Instagram Direct
- **Pipeline Kanban** — drag-and-drop com stages customizáveis
- **Lead Intelligence** — score 0-100, temperatura (frio/morno/quente/em chamas), próxima ação
- **Atribuição** — ctwa_clid, fbclid, gclid, UTMs por campanha/criativo
- **Integração ERP** — recebe webhooks do ERP para vincular vendas a leads
- **Meta CAPI** — envia eventos de conversão (Lead, Purchase) para o Meta Ads
- **Analytics** — receita por campanha, canal, criativo, ROAS, performance de atendentes

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| UI | Tailwind CSS + Radix UI + Recharts |
| Banco | Supabase (PostgreSQL self-hosted) |
| Auth | Supabase Auth |
| Real-time | Supabase Realtime |
| Workers | Node.js (tsx) |
| Deploy | Docker + Easypanel |

---

## Início Rápido

```bash
# 1. Clone o repositório
git clone https://github.com/jhanryw/crm
cd crm

# 2. Configure as variáveis de ambiente
cp .env.example .env.local
# Edite .env.local com seus valores

# 3. Instale dependências
npm install

# 4. Execute as migrations do banco
npm run db:migrate

# 5. Inicie o servidor de desenvolvimento
npm run dev

# 6. (Opcional) Inicie os workers em outro terminal
npm run worker
```

---

## Variáveis de Ambiente Obrigatórias

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
META_APP_SECRET=
META_VERIFY_TOKEN=
ERP_WEBHOOK_SECRET=
```

Veja `.env.example` para a lista completa.

---

## Estrutura de Pastas

```
src/
├── app/
│   ├── (auth)/login/          # Página de login
│   ├── (dashboard)/           # App principal (protegido)
│   │   ├── inbox/             # Inbox de conversas
│   │   ├── pipeline/          # Kanban de leads
│   │   ├── leads/             # Tabela de leads
│   │   ├── analytics/         # Dashboards
│   │   └── campaigns/         # Atribuição
│   └── api/
│       ├── webhooks/whatsapp/ # Webhook Meta WhatsApp
│       ├── webhooks/instagram/# Webhook Instagram
│       ├── webhooks/erp/      # Webhook ERP
│       ├── messages/send/     # Envio de mensagens
│       └── leads/[id]/stage/  # Mover lead no pipeline
├── components/
│   ├── inbox/                 # Componentes de inbox
│   ├── pipeline/              # Kanban board
│   ├── leads/                 # Tabela de leads
│   ├── analytics/             # Dashboards
│   └── layout/                # Sidebar, providers
├── lib/
│   ├── whatsapp/              # WhatsApp Cloud API client
│   ├── instagram/             # Instagram API
│   ├── erp/                   # Integração ERP (read-only)
│   ├── meta-capi/             # Meta Conversions API
│   ├── scoring/               # Motor de lead scoring
│   └── supabase/              # Clientes Supabase
├── workers/
│   ├── scoring-worker.ts      # Recalcula scores a cada 15min
│   ├── capi-flush-worker.ts   # Envia eventos CAPI a cada 5min
│   ├── temperature-worker.ts  # Alertas de leads esquentando
│   └── metrics-worker.ts      # Consolida métricas diárias
└── types/
    └── index.ts               # Todos os tipos TypeScript
```

---

## Documentação

- [ARCHITECTURE.md](ARCHITECTURE.md) — Decisões arquiteturais
- [DATABASE.md](DATABASE.md) — Schemas e tabelas
- [WEBHOOKS.md](WEBHOOKS.md) — Guia de webhooks
- [DEPLOY.md](DEPLOY.md) — Deploy no Easypanel
