-- ============================================================
-- Migration 004: Attribution Schema — Campaigns, Creatives, Events
-- ============================================================

-- ─── Ad Accounts ────────────────────────────────────────────
CREATE TABLE attribution.ad_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL CHECK (platform IN ('meta','google','tiktok')),
  account_id      TEXT NOT NULL,
  account_name    TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, platform, account_id)
);

-- ─── Campaigns ──────────────────────────────────────────────
CREATE TABLE attribution.campaigns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  ad_account_id   UUID REFERENCES attribution.ad_accounts(id) ON DELETE SET NULL,
  platform        TEXT NOT NULL CHECK (platform IN ('meta','google','tiktok','organic','referral')),
  external_id     TEXT,           -- platform campaign ID
  name            TEXT NOT NULL,
  utm_campaign    TEXT,
  objective       TEXT,
  spend           NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_workspace ON attribution.campaigns(workspace_id);
CREATE INDEX idx_campaigns_platform ON attribution.campaigns(workspace_id, platform);

CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON attribution.campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Creatives / Ad Sets ─────────────────────────────────────
CREATE TABLE attribution.creatives (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  campaign_id   UUID NOT NULL REFERENCES attribution.campaigns(id) ON DELETE CASCADE,
  external_id   TEXT,
  name          TEXT NOT NULL,
  utm_content   TEXT,
  utm_term      TEXT,
  thumbnail_url TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_creatives_campaign ON attribution.creatives(campaign_id);

-- ─── Attribution Events ─────────────────────────────────────
-- Every touchpoint that we can attribute to a lead/contact
CREATE TABLE attribution.touch_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES crm.workspaces(id) ON DELETE CASCADE,
  contact_id    UUID REFERENCES crm.contacts(id) ON DELETE SET NULL,
  lead_id       UUID REFERENCES crm.leads(id) ON DELETE SET NULL,
  campaign_id   UUID REFERENCES attribution.campaigns(id) ON DELETE SET NULL,
  creative_id   UUID REFERENCES attribution.creatives(id) ON DELETE SET NULL,
  -- Event info
  event_type    TEXT NOT NULL, -- PageView | InitiateCheckout | Purchase | Lead | Contact
  channel       TEXT NOT NULL, -- whatsapp | instagram | web | organic
  source        TEXT,
  medium        TEXT,
  -- Click IDs
  ctwa_clid     TEXT,
  fbclid        TEXT,
  gclid         TEXT,
  -- Monetary value
  value         NUMERIC(12,2),
  currency      TEXT DEFAULT 'BRL',
  -- CAPI forwarding
  capi_sent     BOOLEAN NOT NULL DEFAULT FALSE,
  capi_sent_at  TIMESTAMPTZ,
  capi_event_id TEXT,
  -- Raw data
  metadata      JSONB NOT NULL DEFAULT '{}',
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_touch_events_workspace ON attribution.touch_events(workspace_id, created_at DESC);
CREATE INDEX idx_touch_events_contact ON attribution.touch_events(contact_id);
CREATE INDEX idx_touch_events_lead ON attribution.touch_events(lead_id);
CREATE INDEX idx_touch_events_campaign ON attribution.touch_events(campaign_id);
CREATE INDEX idx_touch_events_capi ON attribution.touch_events(capi_sent, created_at) WHERE NOT capi_sent;
