-- ============================================================
-- Migration 009: Grant table-level permissions
--
-- GRANT USAGE ON SCHEMA only allows entering the schema.
-- Table-level GRANTs are required for authenticated to read/write rows.
-- RLS policies filter rows, but don't substitute for table privileges.
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA crm           TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA messaging      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA attribution    TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON ALL TABLES IN SCHEMA analytics      TO authenticated;

-- Future tables automatically inherit grants
ALTER DEFAULT PRIVILEGES IN SCHEMA crm        GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA messaging  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA attribution GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics  GRANT SELECT, INSERT, UPDATE         ON TABLES TO authenticated;

-- service_role needs full access for backend workers
GRANT ALL ON ALL TABLES IN SCHEMA crm           TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA messaging      TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA attribution    TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA analytics      TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA capi_queue     TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA crm        GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA messaging  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA attribution GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA capi_queue GRANT ALL ON TABLES TO service_role;
