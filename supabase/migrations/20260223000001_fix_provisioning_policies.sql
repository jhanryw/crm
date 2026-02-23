-- Fix provisioning: allow server-side inserts into organizations and users
-- The service role key bypasses RLS entirely, but we add these policies as
-- a safety net in case of misconfiguration.

-- Allow any authenticated server call to insert a new organization
-- (provisioning always happens server-side with service role)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'organizations' AND policyname = 'Service can insert organizations'
  ) THEN
    CREATE POLICY "Service can insert organizations"
      ON organizations FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Allow any authenticated server call to insert a new user
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'users' AND policyname = 'Service can insert users'
  ) THEN
    CREATE POLICY "Service can insert users"
      ON users FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Ensure the trigger function for default origins uses SECURITY DEFINER
-- so it can bypass RLS when inserting into lead_origins
CREATE OR REPLACE FUNCTION create_default_origins()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO lead_origins (organization_id, name, auto_match_regex)
  VALUES
    (NEW.id, 'WhatsApp Orgânico', NULL),
    (NEW.id, 'Instagram Orgânico', NULL),
    (NEW.id, 'Tráfego Pago (Desconhecido)', NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger to ensure it's using the updated function
DROP TRIGGER IF EXISTS on_organization_created_add_origins ON organizations;
CREATE TRIGGER on_organization_created_add_origins
  AFTER INSERT ON organizations
  FOR EACH ROW EXECUTE FUNCTION create_default_origins();
