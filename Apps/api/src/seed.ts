import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const TENANT_ID = '69c1bc8b-63d9-4753-97ce-7fa2be21e41d';

async function upsertFramework(
  client: Client,
  name: string,
  description: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM frameworks WHERE tenant_id = $1 AND name = $2',
    [TENANT_ID, name]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] framework already exists:', { id: existing.rows[0].id, name });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO frameworks (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id',
    [TENANT_ID, name, description]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted framework:', { id, name, description });
  return id;
}

async function upsertAuditScope(
  client: Client,
  frameworkId: string,
  name: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2 AND name = $3',
    [TENANT_ID, frameworkId, name]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] audit_scope already exists:', { id: existing.rows[0].id, name });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO audit_scopes (tenant_id, framework_id, name) VALUES ($1, $2, $3) RETURNING id',
    [TENANT_ID, frameworkId, name]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted audit_scope:', { id, name, frameworkId });
  return id;
}

async function upsertRisk(
  client: Client,
  scopeId: string,
  title: string,
  assertion?: string,
  rmmLevel?: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM risks WHERE tenant_id = $1 AND scope_id = $2 AND title = $3',
    [TENANT_ID, scopeId, title]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] risk already exists:', { id: existing.rows[0].id, title });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO risks (tenant_id, scope_id, title, assertion, rmm_level) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [TENANT_ID, scopeId, title, assertion ?? null, rmmLevel ?? null]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted risk:', { id, title, scopeId });
  return id;
}

async function upsertControl(
  client: Client,
  riskId: string,
  controlCode: string,
  frequency: string,
  controlType: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM controls WHERE tenant_id = $1 AND control_code = $2',
    [TENANT_ID, controlCode]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] control already exists:', { id: existing.rows[0].id, controlCode });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [TENANT_ID, riskId, controlCode, frequency, controlType]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted control:', { id, controlCode, riskId });
  return id;
}

async function upsertTest(
  client: Client,
  controlId: string,
  procedureSteps: unknown[],
  sampleSize: number
): Promise<string> {
  const stepsJson = JSON.stringify(procedureSteps);
  const existing = await client.query(
    'SELECT id FROM tests WHERE tenant_id = $1 AND control_id = $2',
    [TENANT_ID, controlId]
  );
  if (existing.rows.length > 0) {
    const tid = existing.rows[0].id;
    await client.query(
      'UPDATE tests SET test_type = $1, procedure_steps = $2::jsonb, sample_size = $3 WHERE id = $4',
      ['manual', stepsJson, sampleSize, tid]
    );
    console.log('[seed] test already exists, updated:', { id: tid, controlId });
    return tid;
  }
  const ins = await client.query(
    'INSERT INTO tests (tenant_id, control_id, test_type, procedure_steps, sample_size) VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id',
    [TENANT_ID, controlId, 'manual', stepsJson, sampleSize]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted test:', { id, controlId, procedure_steps: procedureSteps });
  return id;
}

async function upsertEvidence(
  client: Client,
  file_name: string,
  file_path: string,
  sha256: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM evidence WHERE tenant_id = $1 AND sha256 = $2',
    [TENANT_ID, sha256]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] evidence already exists:', { id: existing.rows[0].id, file_name });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO evidence (tenant_id, file_name, file_path, sha256) VALUES ($1, $2, $3, $4) RETURNING id',
    [TENANT_ID, file_name, file_path, sha256]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted evidence:', { id, file_name, file_path, sha256 });
  return id;
}

async function upsertConclusion(
  client: Client,
  testId: string,
  summary: string,
  overallResult: string = 'pass'
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM conclusions WHERE tenant_id = $1 AND test_id = $2',
    [TENANT_ID, testId]
  );
  if (existing.rows.length > 0) {
    await client.query('UPDATE conclusions SET overall_result = $1, summary = $2 WHERE id = $3', [
      overallResult,
      summary,
      existing.rows[0].id,
    ]);
    console.log('[seed] conclusion already exists, updated:', { id: existing.rows[0].id, testId });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO conclusions (tenant_id, test_id, overall_result, summary) VALUES ($1, $2, $3, $4) RETURNING id',
    [TENANT_ID, testId, overallResult, summary]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted conclusion:', { id, testId, overall_result: overallResult, summary });
  return id;
}

async function addGapData(
  client: Client,
  accessControlScopeId: string,
  availabilityScopeId: string,
  confidentialityScopeId: string
): Promise<void> {
  const gaps: Array<{ title: string; scopeId: string }> = [
    { title: 'Weak Password Policy', scopeId: accessControlScopeId },
    { title: 'Unpatched Systems', scopeId: accessControlScopeId },
    { title: 'No Backup Verification', scopeId: availabilityScopeId },
    { title: 'Third Party Access', scopeId: confidentialityScopeId },
  ];

  for (const { title, scopeId } of gaps) {
    const existing = await client.query(
      'SELECT id FROM risks WHERE tenant_id = $1 AND title = $2',
      [TENANT_ID, title]
    );
    if (existing.rows.length > 0) {
      console.log('[seed] gap risk already exists:', { id: existing.rows[0].id, title });
      continue;
    }
    const ins = await client.query(
      'INSERT INTO risks (tenant_id, scope_id, title, assertion, rmm_level) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [TENANT_ID, scopeId, title, null, null]
    );
    const id = ins.rows[0].id;
    console.log('[seed] inserted gap risk:', { id, title, scopeId });
  }
}

async function seed() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();

  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [TENANT_ID]);

    // Ensure tenant exists
    const tenantRes = await client.query('SELECT id FROM tenants WHERE id = $1', [TENANT_ID]);
    if (tenantRes.rows.length === 0) {
      await client.query('INSERT INTO tenants (id, name) VALUES ($1, $2)', [
        TENANT_ID,
        'Seed Tenant',
      ]);
      console.log('[seed] inserted tenant:', TENANT_ID);
    }

    // 1. Frameworks (2)
    const isoFrameworkId = await upsertFramework(client, 'ISO 27001', 'Information security management');
    const socFrameworkId = await upsertFramework(client, 'SOC 2 Type II', 'Service organization controls');

    // 2. Audit Scopes (4)
    const accessControlScopeId = await upsertAuditScope(client, isoFrameworkId, 'Access Control');
    const incidentMgmtScopeId = await upsertAuditScope(client, isoFrameworkId, 'Incident Management');
    const availabilityScopeId = await upsertAuditScope(client, socFrameworkId, 'Availability');
    const confidentialityScopeId = await upsertAuditScope(client, socFrameworkId, 'Confidentiality');

    // 3. Risks (6)
    const risk1Id = await upsertRisk(client, accessControlScopeId, 'Unauthorized Access');
    const risk2Id = await upsertRisk(client, accessControlScopeId, 'Privilege Escalation');
    const risk3Id = await upsertRisk(client, incidentMgmtScopeId, 'Slow Incident Response');
    const risk4Id = await upsertRisk(client, availabilityScopeId, 'System Downtime');
    const risk5Id = await upsertRisk(client, confidentialityScopeId, 'Data Breach');
    const risk6Id = await upsertRisk(client, confidentialityScopeId, 'Insider Threat');

    // 4. Controls (6, one per risk)
    const ctrl1Id = await upsertControl(client,
      risk1Id,
      'CTRL-001',
      'continuous',
      'preventive'
    );
    const ctrl2Id = await upsertControl(client,
      risk2Id,
      'CTRL-002',
      'monthly',
      'preventive'
    );
    const ctrl3Id = await upsertControl(client,
      risk3Id,
      'CTRL-003',
      'quarterly',
      'detective'
    );
    const ctrl4Id = await upsertControl(client,
      risk4Id,
      'CTRL-004',
      'continuous',
      'preventive'
    );
    const ctrl5Id = await upsertControl(client,
      risk5Id,
      'CTRL-005',
      'continuous',
      'preventive'
    );
    const ctrl6Id = await upsertControl(client,
      risk6Id,
      'CTRL-006',
      'daily',
      'detective'
    );

    // 5. Tests (6, one per control)
    const test1Id = await upsertTest(
      client,
      ctrl1Id,
      ['Verify MFA is enabled for all users', 'Check MFA enrollment status in IAM'],
      10
    );
    const test2Id = await upsertTest(
      client,
      ctrl2Id,
      ['Review role assignments', 'Verify least privilege access'],
      10
    );
    const test3Id = await upsertTest(
      client,
      ctrl3Id,
      ['Review incident response playbook', 'Verify escalation procedures'],
      10
    );
    const test4Id = await upsertTest(
      client,
      ctrl4Id,
      ['Verify redundancy configuration', 'Check failover procedures'],
      10
    );
    const test5Id = await upsertTest(
      client,
      ctrl5Id,
      ['Verify encryption at rest', 'Check key management'],
      10
    );
    const test6Id = await upsertTest(
      client,
      ctrl6Id,
      ['Review activity logs', 'Verify monitoring coverage'],
      10
    );

    // 6. Evidence (3)
    await upsertEvidence(client, 'mfa-screenshot.png', '/evidence/mfa', 'abc123');
    await upsertEvidence(client, 'access-log.pdf', '/evidence/logs', 'def456');
    await upsertEvidence(client, 'encryption-report.pdf', '/evidence/encryption', 'ghi789');

    // 7. Conclusions (2)
    await upsertConclusion(client, test1Id, 'MFA is enabled for all sampled users', 'pass');
    await upsertConclusion(client, test2Id, 'Role-based access is properly configured', 'pass');

    // 8. Gap data (risks without controls)
    await addGapData(client, accessControlScopeId, availabilityScopeId, confidentialityScopeId);

    await client.query('COMMIT');
    console.log('[seed] done');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
