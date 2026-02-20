# Agents - Antigravity CRM

## Stack
- Frontend: Next.js (App Router), TypeScript, Tailwind
- Backend: Supabase (Postgres + RLS + Realtime)
- Auth: Logto (OIDC)
- Messaging: Meta Webhooks (WhatsApp Cloud API + Instagram Graph)
- Email: Listmonk (futuro), SMTP opcional

## Non-goals (por enquanto)
- Não integrar Meta/Google antes do Kanban + Inbox + Métricas estarem funcionais.
- Não usar service_role no client.
- Não criar microserviços extras. Tudo via API routes/Edge Functions.

## Repo conventions
- Tudo em TypeScript
- API routes em /app/api/*
- Camada de acesso ao Supabase em /src/lib/supabase/*
- Validação de payloads com Zod
- Tabelas e migrations em /supabase/migrations
- Seeds em /supabase/seed.sql

## Feature flags (usar env)
- FEATURE_META_INBOX
- FEATURE_WHATSAPP_OFFICIAL
- FEATURE_CONVERSIONS
- FEATURE_EMAIL_MARKETING
