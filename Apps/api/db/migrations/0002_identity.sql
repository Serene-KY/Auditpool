-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Users (tenant-scoped); tenant_id required for RLS
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  UNIQUE(tenant_id, email)
);

-- Roles (tenant-scoped)
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid,
  UNIQUE(tenant_id, name)
);

-- User roles junction
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  UNIQUE(user_id, role_id)
);

-- Fix: add tenant_id to roles/users if missing (tables created by prior migrations)
DO $$
DECLARE
  default_tenant_id uuid;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants LIMIT 1;
  IF default_tenant_id IS NULL THEN
    RETURN;
  END IF;

  -- roles: add tenant_id if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'roles')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'roles' AND column_name = 'tenant_id') THEN
    ALTER TABLE roles DROP CONSTRAINT IF EXISTS roles_name_key;
    ALTER TABLE roles ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE roles SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE roles ALTER COLUMN tenant_id SET NOT NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS roles_tenant_name_unique ON roles(tenant_id, name);
  END IF;

  -- users: add tenant_id if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'tenant_id') THEN
    ALTER TABLE users ADD COLUMN tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE;
    UPDATE users SET tenant_id = default_tenant_id WHERE tenant_id IS NULL;
    ALTER TABLE users ALTER COLUMN tenant_id SET NOT NULL;
  END IF;
END $$;

-- RLS
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenants_tenant_rls ON tenants;
CREATE POLICY tenants_tenant_rls ON tenants
  FOR ALL USING (id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS users_tenant_rls ON users;
CREATE POLICY users_tenant_rls ON users
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS roles_tenant_rls ON roles;
CREATE POLICY roles_tenant_rls ON roles
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);

DROP POLICY IF EXISTS user_roles_tenant_rls ON user_roles;
CREATE POLICY user_roles_tenant_rls ON user_roles
  FOR ALL USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
