-- Engagements
CREATE TABLE IF NOT EXISTS engagements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

ALTER TABLE engagements ENABLE ROW LEVEL SECURITY;
CREATE POLICY engagements_tenant_rls ON engagements
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Add tables: processes, systems, risks, controls, tests, issues, conclusions
-- For brevity, follow the same pattern as engagements (tenant_id, RLS, timestamps)