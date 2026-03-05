# Database Migrations (ISA lifecycle)

Run in order via Supabase SQL Editor or psql.

| # | File | Content |
|---|------|---------|
| 1 | 0001_extensions.sql | pgcrypto, uuid-ossp |
| 2 | 0002_identity.sql | tenants, users, roles, user_roles + RLS |
| 3 | 0003_domain.sql | frameworks, audit_scopes, risks, controls, tests + RLS |
| 4 | 0004_evidence.sql | evidence, evidence_links, conclusions + indexes + RLS |
| 5 | 0005_workflows.sql | workflow_events, signoffs + RLS |
| 6 | 0006_logs.sql | audit_logs, ai_logs + indexes + RLS |
| 7 | 0007_tenant_context.sql | set_tenant_context(tenant_uuid) |

**Standard audit fields** on tenant tables: created_at/by, updated_at/by, version, is_deleted, deleted_at/by.

**Usage:** Call `SELECT set_tenant_context('tenant-uuid-here');` at session start before queries.
