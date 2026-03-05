-- Users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  email text NOT NULL UNIQUE,
  name text,
  created_at timestamptz DEFAULT now(),
  created_by uuid,
  updated_at timestamptz,
  updated_by uuid,
  version int DEFAULT 1,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  deleted_by uuid
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_tenant_rls ON users
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  role_id uuid NOT NULL REFERENCES roles(id),
  tenant_id uuid NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_tenant_rls ON user_roles
  FOR ALL USING (tenant_id = current_setting('app.tenant_id')::uuid);