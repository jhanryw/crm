# QARVON CRM - PRD

Sempre responder em português.

## 1. Visão Geral

Antigravity CRM é um sistema open-source, self-hosted, focado em varejo e lojistas que utilizam tráfego pago para gerar negociações via WhatsApp e Instagram.

O sistema centraliza:
- Inbox unificado (WhatsApp + Instagram)
- Kanban de negociações
- Métricas de funil
- ROI de tráfego
- Disparos via WhatsApp oficial e email
- Dashboards estratégicos

Objetivo principal:
Permitir que empresas saibam exatamente:
- Quanto venderam
- De qual campanha veio
- Qual vendedor performa melhor
- Qual canal é mais rentável

---

## 2. Público-Alvo

- Lojistas físicos
- E-commerces híbridos
- Empresas de varejo
- Franquias de produtos

---

## 3. Problemas que Resolve

- Não saber qual campanha gerou a venda
- Não medir taxa de conversão por etapa
- Não ter controle do tempo de resposta
- Não saber qual vendedor performa melhor
- Leads espalhados entre WhatsApp e Instagram
- Dificuldade de atribuição em campanhas de engajamento

---

## 4. Funcionalidades Principais

### 4.1 Inbox Unificado
- WhatsApp API Oficial
- Instagram Direct
- Visualização por conversa
- Status da negociação
- SLA de resposta

### 4.2 Kanban Editável
- Etapas customizáveis
- Drag & drop
- Valor por negociação
- Cálculo automático de pipeline total
- Histórico de movimentação

### 4.3 Métricas de Funil
- Conversão por etapa
- Tempo médio por etapa
- Tempo médio de resposta
- Taxa de fechamento

### 4.4 Atribuição de Lead (sem UTM)

Estratégia:
- Cada campanha de engajamento gera:
  - Código de campanha
  - Número WhatsApp específico OU
  - Keyword automática
  - Template vinculado
  - ID oculto injetado na URL do WhatsApp

Opções:
1. Deep link com parâmetro prefill
2. Número virtual por campanha
3. Keyword inicial detectada via webhook
4. Tracking via Meta Click ID (wa.me + param)

Sistema captura origem no primeiro evento recebido.

### 4.5 Webhooks de Entrada

Ao criar webhook:
- Definir origem:
  - site
  - lp
  - meta_ads
  - google_ads
  - orgânico

Ao receber dados:
- Cria lead automaticamente no Kanban
- Define etapa inicial
- Define vendedor automático (regra de distribuição)

### 4.6 Dashboards

- Receita total
- Receita por vendedor
- Receita por canal
- ROI por campanha
- Negociações abertas
- Pipeline previsto
- Conversões por etapa

### 4.7 Disparos

- WhatsApp Templates oficiais
- E-mail marketing
- Sequências automatizadas
- Reengajamento

### 4.8 Permissões

#### Vendedor
- Vê apenas leads atribuídos
- Vê apenas suas métricas

#### Gerente
- Vê todos leads
- Vê todos inbox
- Vê dashboards globais

#### Admin
- Configura integrações
- Cria webhooks
- Define etapas
- Define regras

---

## 5. Indicadores Principais

- SLA de resposta
- Conversão lead → venda
- ROI por campanha
- Receita por vendedor
- Ticket médio
- LTV estimado

---

## 6. Diferencial Estratégico

CRM feito para tráfego pago de WhatsApp.
Foco em atribuição real e mensuração de retorno.

## 7. Insiprações

Todo material de inspiração pro design do nosso CRM está disponível na pasta `Inspirações`.

