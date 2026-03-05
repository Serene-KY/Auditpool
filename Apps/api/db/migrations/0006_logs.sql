-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type text,
  entity_id uuid,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);

-- AI logs
CREATE TABLE IF NOT EXISTS ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  model text,
  prompt_tokens int,
  completion_tokens int,
  payload jsonb,
  created_at timestamptz DEFAULT now(),
  created_by uuid
);

CREATE INDEX idx_ai_logs_tenant ON ai_logs(tenant_id);
CREATE INDEX idx_ai_logs_created ON ai_logs(created_at DESC);

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_tenant_rls ON audit_logs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY ai_logs_tenant_rls ON ai_logs
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
