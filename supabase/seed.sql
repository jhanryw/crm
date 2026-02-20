-- Seed Stages
INSERT INTO stages (organization_id, name, order_index, probability)
VALUES
  ((SELECT id FROM organizations LIMIT 1), 'New', 0, 10),
  ((SELECT id FROM organizations LIMIT 1), 'Qualified', 1, 30),
  ((SELECT id FROM organizations LIMIT 1), 'Proposal', 2, 50),
  ((SELECT id FROM organizations LIMIT 1), 'Negotiation', 3, 80),
  ((SELECT id FROM organizations LIMIT 1), 'Closed Won', 4, 100),
  ((SELECT id FROM organizations LIMIT 1), 'Closed Lost', 5, 0);

-- Seed Webhook
INSERT INTO webhooks (organization_id, origin, token, active)
VALUES
  ((SELECT id FROM organizations LIMIT 1), 'site_demo', 'dev_token_123', true);

-- Seed Campaign
INSERT INTO campaigns (organization_id, name, channel, tracking_code)
VALUES
  ((SELECT id FROM organizations LIMIT 1), 'Summer Sale', 'meta_ads', 'CAMP-SUMMER2024');
