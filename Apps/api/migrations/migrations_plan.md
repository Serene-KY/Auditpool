# Migration Plan — Remaining

- **0003_users_roles.sql** → users, roles, user_roles
- **0004_engagements.sql** → engagements, processes, systems, risks, controls, tests, issues, conclusions
- **0005_controls_evidence.sql** → evidence, evidence_links + indexes
- **0008_foreign_keys.sql** → add FK constraints between engagement-scoped tables
- **0007_set_tenant_context.sql** → set_tenant_context function
