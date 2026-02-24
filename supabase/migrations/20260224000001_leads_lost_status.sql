-- Migration: add status/lost_reason to leads + facebook_pixel channel type
-- Run in Supabase SQL editor

-- 1. Extend channel_type enum with facebook_pixel (idempotent)
DO $$ BEGIN
  ALTER TYPE channel_type ADD VALUE 'facebook_pixel';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Add status to leads (text, no enum - simpler to extend)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';

-- 3. Add lost_reason to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS lost_reason text;

-- 4. Backfill existing rows
UPDATE leads SET status = 'active' WHERE status IS NULL;

-- 5. Add check constraint safely
DO $$ BEGIN
  ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('active', 'lost', 'won'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
