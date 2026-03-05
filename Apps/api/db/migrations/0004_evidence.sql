-- Fix: add tenant_id to evidence/evidence_links/conclusions if missing (prior migration schema)
DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
  IF default_tenant_id IS NULL THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence' AND column_name = 'tenant_id') THEN
    ALTER TABLE evidence ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE evidence SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE evidence ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence_links')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence_links' AND column_name = 'tenant_id') THEN
    ALTER TABLE evidence_links ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE evidence_links SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE evidence_links ALTER COLUMN tenant_id SET NOT NULL;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conclusions')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'conclusions' AND column_name = 'tenant_id') THEN
    ALTER TABLE conclusions ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE conclusions SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE conclusions ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- Evidence (per tenant, linked to test)
CREATE TABLE IF NOT EXISTS evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  sha256 text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  UNIQUE(tenant_id, test_id, sha256)
);

-- Evidence links (links evidence to controls/tests - many-to-many if needed)
CREATE TABLE IF NOT EXISTS evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  evidence_id uuid NOT NULL REFERENCES evidence(id) ON DELETE CASCADE,
  target_type text NOT NULL,
  target_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  UNIQUE(evidence_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_evidence_links_evidence_id ON evidence_links(evidence_id);
CREATE INDEX IF NOT EXISTS idx_evidence_links_tenant ON evidence_links(tenant_id);

-- Add target_type/target_id to evidence_links if missing (prior migration schema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence_links')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'evidence_links' AND column_name = 'target_type') THEN
    ALTER TABLE evidence_links ADD COLUMN target_type text;
    ALTER TABLE evidence_links ADD COLUMN target_id uuid;
    UPDATE evidence_links SET target_type = 'test', target_id = COALESCE(
      (SELECT t.id FROM tests t LIMIT 1),
      '00000000-0000-0000-0000-000000000000'::uuid
    ) WHERE target_type IS NULL;
    ALTER TABLE evidence_links ALTER COLUMN target_type SET NOT NULL;
    ALTER TABLE evidence_links ALTER COLUMN target_id SET NOT NULL;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_evidence_links_target ON evidence_links(target_type, target_id);

-- Conclusions (per control or test)
CREATE TABLE IF NOT EXISTS conclusions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  test_id uuid NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
  conclusion text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

-- RLS
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE conclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_tenant_rls ON evidence;
CREATE POLICY evidence_tenant_rls ON evidence
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS evidence_links_tenant_rls ON evidence_links;
CREATE POLICY evidence_links_tenant_rls ON evidence_links
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS conclusions_tenant_rls ON conclusions;
CREATE POLICY conclusions_tenant_rls ON conclusions
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
