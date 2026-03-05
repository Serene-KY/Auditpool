import type { PoolClient } from 'pg';
import { z } from 'zod';

const uuidSchema = z.string().uuid();

export const getFrameworksSchema = z.object({ tenantId: uuidSchema });
export const getAuditScopesSchema = z.object({
  tenantId: uuidSchema,
  frameworkId: uuidSchema,
});
export const getRisksSchema = z.object({
  tenantId: uuidSchema,
  scopeId: uuidSchema,
});
export const getControlsSchema = z.object({
  tenantId: uuidSchema,
  riskId: uuidSchema,
});
export const getTestsSchema = z.object({
  tenantId: uuidSchema,
  controlId: uuidSchema,
});
export const getEvidenceSchema = z.object({ tenantId: uuidSchema });
export const createFrameworkSchema = z.object({
  tenantId: uuidSchema,
  name: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
});
export const createRiskSchema = z.object({
  tenantId: uuidSchema,
  scopeId: uuidSchema,
  title: z.string().min(1).max(500),
  assertion: z.string().max(2000).optional(),
  rmmLevel: z.string().max(100).optional(),
});
export const createControlSchema = z.object({
  tenantId: uuidSchema,
  riskId: uuidSchema,
  controlCode: z.string().min(1).max(100),
  frequency: z.string().max(100).optional(),
  controlType: z.string().max(100).optional(),
});

export async function get_frameworks(
  db: PoolClient,
  params: z.infer<typeof getFrameworksSchema>
) {
  const { tenantId } = getFrameworksSchema.parse(params);
  const r = await db.query(
    `SELECT id, tenant_id, name, description, created_at FROM frameworks WHERE tenant_id = $1`,
    [tenantId]
  );
  return r.rows;
}

export async function get_audit_scopes(
  db: PoolClient,
  params: z.infer<typeof getAuditScopesSchema>
) {
  const { tenantId, frameworkId } = getAuditScopesSchema.parse(params);
  const r = await db.query(
    `SELECT id, tenant_id, name, created_at FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2`,
    [tenantId, frameworkId]
  );
  return r.rows;
}

export async function get_risks(
  db: PoolClient,
  params: z.infer<typeof getRisksSchema>
) {
  const { tenantId, scopeId } = getRisksSchema.parse(params);
  const r = await db.query(
    `SELECT id, tenant_id, scope_id, title, assertion, rmm_level FROM risks WHERE tenant_id = $1 AND scope_id = $2`,
    [tenantId, scopeId]
  );
  return r.rows;
}

export async function get_controls(
  db: PoolClient,
  params: z.infer<typeof getControlsSchema>
) {
  const { tenantId, riskId } = getControlsSchema.parse(params);
  const r = await db.query(
    `SELECT id, tenant_id, risk_id, name, description, created_at FROM controls WHERE tenant_id = $1 AND risk_id = $2`,
    [tenantId, riskId]
  );
  return r.rows;
}

export async function get_tests(
  db: PoolClient,
  params: z.infer<typeof getTestsSchema>
) {
  const { tenantId, controlId } = getTestsSchema.parse(params);
  const r = await db.query(
    `SELECT id, tenant_id, control_id, name, description, created_at FROM tests WHERE tenant_id = $1 AND control_id = $2`,
    [tenantId, controlId]
  );
  return r.rows;
}

export async function get_evidence(
  db: PoolClient,
  params: z.infer<typeof getEvidenceSchema>
) {
  const { tenantId } = getEvidenceSchema.parse(params);
  const r = await db.query(
    `SELECT id, tenant_id, test_id, sha256, created_at FROM evidence WHERE tenant_id = $1`,
    [tenantId]
  );
  return r.rows;
}

export async function create_framework(
  db: PoolClient,
  params: z.infer<typeof createFrameworkSchema>
) {
  const { tenantId, name, description } = createFrameworkSchema.parse(params);
  const r = await db.query(
    `INSERT INTO frameworks (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id, tenant_id, name, description, created_at`,
    [tenantId, name, description ?? null]
  );
  return r.rows[0];
}

export async function create_risk(
  db: PoolClient,
  params: z.infer<typeof createRiskSchema>
) {
  const { tenantId, scopeId, title, assertion, rmmLevel } =
    createRiskSchema.parse(params);
  const desc = [assertion, rmmLevel].filter(Boolean).join(' | ') || null;
  const r = await db.query(
    `INSERT INTO risks (tenant_id, audit_scope_id, name, description) VALUES ($1, $2, $3, $4) RETURNING id, tenant_id, audit_scope_id, name, description, created_at`,
    [tenantId, scopeId, title, desc]
  );
  return r.rows[0];
}

export async function create_control(
  db: PoolClient,
  params: z.infer<typeof createControlSchema>
) {
  const { tenantId, riskId, controlCode, frequency, controlType } =
    createControlSchema.parse(params);
  const desc = [frequency, controlType].filter(Boolean).join(' | ') || null;
  const r = await db.query(
    `INSERT INTO controls (tenant_id, risk_id, name, description) VALUES ($1, $2, $3, $4) RETURNING id, tenant_id, risk_id, name, description, created_at`,
    [tenantId, riskId, controlCode, desc]
  );
  return r.rows[0];
}

export const TOOL_NAMES = [
  'get_frameworks',
  'get_audit_scopes',
  'get_risks',
  'get_controls',
  'get_tests',
  'get_evidence',
  'create_framework',
  'create_risk',
  'create_control',
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

const toolImpls = {
  get_frameworks,
  get_audit_scopes,
  get_risks,
  get_controls,
  get_tests,
  get_evidence,
  create_framework,
  create_risk,
  create_control,
};

export async function executeTool(
  db: PoolClient,
  name: ToolName,
  params: Record<string, unknown>
): Promise<unknown> {
  const impl = toolImpls[name];
  if (!impl) throw new Error(`Unknown tool: ${name}`);
  return impl(db, params as never);
}
