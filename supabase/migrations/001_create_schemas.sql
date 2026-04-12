-- ============================================================
-- Migration 001: Create CRM schemas
-- CRM uses its own schemas within the shared Supabase instance.
-- It NEVER touches ERP tables directly.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS crm;
CREATE SCHEMA IF NOT EXISTS messaging;
CREATE SCHEMA IF NOT EXISTS attribution;
CREATE SCHEMA IF NOT EXISTS analytics;
CREATE SCHEMA IF NOT EXISTS capi_queue;

-- Grant usage to authenticated and service roles
GRANT USAGE ON SCHEMA crm TO authenticated, service_role;
GRANT USAGE ON SCHEMA messaging TO authenticated, service_role;
GRANT USAGE ON SCHEMA attribution TO authenticated, service_role;
GRANT USAGE ON SCHEMA analytics TO authenticated, service_role;
GRANT USAGE ON SCHEMA capi_queue TO service_role;

-- Helper: updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
