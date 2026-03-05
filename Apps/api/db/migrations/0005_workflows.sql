-- Workflow events
CREATE TABLE IF NOT EXISTS workflow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- Signoffs
CREATE TABLE IF NOT EXISTS signoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

-- RLS
ALTER TABLE workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE signoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY workflow_events_tenant_rls ON workflow_events
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY signoffs_tenant_rls ON signoffs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
