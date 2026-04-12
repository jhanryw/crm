-- ============================================================
-- Migration 003: Messaging Schema — Channels, Conversations, Messages
-- ============================================================

-- ─── Channels (WhatsApp numbers, Instagram accounts) ────────
CREATE TABLE messaging.channels (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('whatsapp','instagram')),
  name            TEXT NOT NULL,
  -- WhatsApp specific
  phone_number_id TEXT,           -- Meta phone_number_id
  phone_number    TEXT,           -- E.164
  waba_id         TEXT,           -- WhatsApp Business Account ID
  -- Instagram specific
  instagram_account_id TEXT,
  instagram_username   TEXT,
  -- Auth
  access_token    TEXT,           -- encrypted at application level
  -- State
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_channels_workspace ON messaging.channels(workspace_id);
CREATE INDEX idx_channels_phone ON messaging.channels(phone_number_id);
CREATE INDEX idx_channels_instagram ON messaging.channels(instagram_account_id);

CREATE TRIGGER channels_updated_at
  BEFORE UPDATE ON messaging.channels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Conversations ──────────────────────────────────────────
CREATE TABLE messaging.conversations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  channel_id      UUID NOT NULL REFERENCES messaging.channels(id) ON DELETE CASCADE,
  contact_id      UUID NOT NULL REFERENCES crm.contacts(id) ON DELETE CASCADE,
  lead_id         UUID REFERENCES crm.leads(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  -- External IDs (channel-specific conversation IDs)
  external_id     TEXT,           -- WhatsApp: contact phone; Instagram: thread ID
  -- State
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','pending','resolved','archived')),
  is_unread       BOOLEAN NOT NULL DEFAULT TRUE,
  -- Last message preview
  last_message    TEXT,
  last_message_at TIMESTAMPTZ,
  -- Attribution snapshot (copied from lead at conversation creation)
  ctwa_clid       TEXT,
  -- Timestamps
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(channel_id, external_id)
);

CREATE INDEX idx_conversations_workspace ON messaging.conversations(workspace_id, last_message_at DESC);
CREATE INDEX idx_conversations_channel ON messaging.conversations(channel_id);
CREATE INDEX idx_conversations_contact ON messaging.conversations(contact_id);
CREATE INDEX idx_conversations_lead ON messaging.conversations(lead_id);
CREATE INDEX idx_conversations_assigned ON messaging.conversations(assigned_to);
CREATE INDEX idx_conversations_status ON messaging.conversations(workspace_id, status);

CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON messaging.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Messages ───────────────────────────────────────────────
CREATE TABLE messaging.messages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID NOT NULL REFERENCES messaging.conversations(id) ON DELETE CASCADE,
  workspace_id      UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  -- Direction
  direction         TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  sender_type       TEXT NOT NULL CHECK (sender_type IN ('contact','agent','bot','system')),
  sender_agent_id   UUID REFERENCES crm.workspace_members(id) ON DELETE SET NULL,
  -- Content
  type              TEXT NOT NULL DEFAULT 'text', -- text | image | audio | video | document | template | interactive | sticker | reaction | location | unsupported
  content           TEXT,
  media_url         TEXT,
  media_mime_type   TEXT,
  media_size        BIGINT,
  template_name     TEXT,
  template_vars     JSONB,
  -- External IDs
  external_id       TEXT UNIQUE,  -- channel message ID (wamid / instagram message id)
  -- Status (for outbound)
  status            TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued','sent','delivered','read','failed')),
  status_updated_at TIMESTAMPTZ,
  error_code        TEXT,
  error_message     TEXT,
  -- Attribution
  ctwa_clid         TEXT,         -- present only on first inbound from an ad click
  referral          JSONB,        -- WhatsApp referral object
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messaging.messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_workspace ON messaging.messages(workspace_id, created_at DESC);
CREATE INDEX idx_messages_external ON messaging.messages(external_id);

CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messaging.messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Message Templates ──────────────────────────────────────
CREATE TABLE messaging.templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  channel_id    UUID NOT NULL REFERENCES messaging.channels(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'pt_BR',
  category      TEXT NOT NULL, -- UTILITY | MARKETING | AUTHENTICATION
  components    JSONB NOT NULL,
  status        TEXT NOT NULL DEFAULT 'APPROVED', -- APPROVED | PENDING | REJECTED
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, name, language)
);

CREATE INDEX idx_templates_workspace ON messaging.templates(workspace_id);

-- ─── Quick Replies ───────────────────────────────────────────
CREATE TABLE messaging.quick_replies (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  shortcut      TEXT NOT NULL,
  title         TEXT NOT NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, shortcut)
);
