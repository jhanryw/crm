-- MVP Final: índices de performance para inbox e mensagens

CREATE INDEX IF NOT EXISTS idx_messages_conv_created
    ON messages(conversation_id, created_at);

CREATE INDEX IF NOT EXISTS idx_conv_org_status
    ON inbox_conversations(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_leads_org_stage
    ON leads(organization_id, stage_id);

CREATE INDEX IF NOT EXISTS idx_integrations_org_channel
    ON integrations(organization_id, channel);

-- Garante que updated_at existe em inbox_conversations (pode não ter sido criado)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'inbox_conversations' AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE inbox_conversations ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;
END $$;
