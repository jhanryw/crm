-- Migration: Support multiple WhatsApp instances per organization
-- Allows businesses to manage multiple phone numbers/WhatsApp accounts

-- 1. Drop existing UNIQUE constraint to allow multiple WhatsApp per org
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_organization_id_channel_key;

-- 2. Add name field for identifying each WhatsApp instance
-- (e.g., "Principal", "Vendas", "Suporte", etc)
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Principal';

-- 3. Create new UNIQUE constraint (allow multiple per org, unique per name)
ALTER TABLE integrations
    ADD CONSTRAINT integrations_unique_name_per_org
    UNIQUE(organization_id, channel, name);

-- 4. Add reference to whatsapp instance in CONVERSATIONS
-- (tracks current/last instance - updated when message arrives)
-- This ensures replies always go back to the number that last messaged
ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES integrations(id);

-- 5. Add reference to whatsapp instance in LEADS
-- (historical: which instance created the lead)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS whatsapp_instance_id UUID REFERENCES integrations(id);

-- 6. Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_instance ON inbox_conversations(whatsapp_instance_id);
CREATE INDEX IF NOT EXISTS idx_leads_whatsapp_instance ON leads(whatsapp_instance_id);
