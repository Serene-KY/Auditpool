-- Frameworks (tenant-scoped)
CREATE TABLE IF NOT EXISTS frameworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

-- Audit scopes (scope of an audit, links to framework)
CREATE TABLE IF NOT EXISTS audit_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  framework_id uuid NOT NULL REFERENCES frameworks(id) ON DELETE CASCADE,
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

-- Risks (per audit scope)
CREATE TABLE IF NOT EXISTS risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  audit_scope_id uuid NOT NULL REFERENCES audit_scopes(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

-- Controls (per risk)
CREATE TABLE IF NOT EXISTS controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

-- Tests (per control)
CREATE TABLE IF NOT EXISTS tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES controls(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
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
ALTER TABLE frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_scopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY frameworks_tenant_rls ON frameworks
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY audit_scopes_tenant_rls ON audit_scopes
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY risks_tenant_rls ON risks
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY controls_tenant_rls ON controls
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

CREATE POLICY tests_tenant_rls ON tests
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
