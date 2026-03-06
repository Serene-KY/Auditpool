import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const TENANT_ID = '69c1bc8b-63d9-4753-97ce-7fa2be21e41d';

async function upsertFramework(
  client: Client,
  tenantId: string,
  name: string,
  description: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM frameworks WHERE tenant_id = $1 AND name = $2',
    [tenantId, name]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] framework already exists:', { id: existing.rows[0].id, name });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO frameworks (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, name, description]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted framework:', { id, name, description });
  return id;
}

async function upsertAuditScope(
  client: Client,
  tenantId: string,
  frameworkId: string,
  name: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2 AND name = $3',
    [tenantId, frameworkId, name]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] audit_scope already exists:', { id: existing.rows[0].id, name });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO audit_scopes (tenant_id, framework_id, name) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, frameworkId, name]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted audit_scope:', { id, name, frameworkId });
  return id;
}

async function upsertRisk(
  client: Client,
  tenantId: string,
  scopeId: string,
  title: string,
  assertion?: string,
  rmmLevel?: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM risks WHERE tenant_id = $1 AND scope_id = $2 AND title = $3',
    [tenantId, scopeId, title]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] risk already exists:', { id: existing.rows[0].id, title });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO risks (tenant_id, scope_id, title, assertion, rmm_level) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [tenantId, scopeId, title, assertion ?? null, rmmLevel ?? null]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted risk:', { id, title, scopeId });
  return id;
}

async function upsertControl(
  client: Client,
  tenantId: string,
  riskId: string,
  controlCode: string,
  frequency: string,
  controlType: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM controls WHERE tenant_id = $1 AND control_code = $2',
    [tenantId, controlCode]
  );
  if (existing.rows.length > 0) {
    console.log('[seed] control already exists:', { id: existing.rows[0].id, controlCode });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [tenantId, riskId, controlCode, frequency, controlType]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted control:', { id, controlCode, riskId });
  return id;
}

async function upsertTest(
  client: Client,
  tenantId: string,
  controlId: string,
  procedureSteps: unknown[],
  sampleSize: number
): Promise<string> {
  const stepsJson = JSON.stringify(procedureSteps);
  const existing = await client.query(
    'SELECT id FROM tests WHERE tenant_id = $1 AND control_id = $2',
    [tenantId, controlId]
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
    [tenantId, controlId, 'manual', stepsJson, sampleSize]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted test:', { id, controlId, procedure_steps: procedureSteps });
  return id;
}

async function upsertEvidence(
  client: Client,
  tenantId: string,
  testId: string,
  sha256: string
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM evidence WHERE tenant_id = $1 AND sha256 = $2',
    [tenantId, sha256]
  );
  if (existing.rows.length > 0) {
    await client.query(
      'UPDATE evidence SET test_id = $1 WHERE id = $2',
      [testId, existing.rows[0].id]
    );
    console.log('[seed] evidence already exists, updated:', { id: existing.rows[0].id, sha256, testId });
    return existing.rows[0].id;
  }
  const ins = await client.query(
    'INSERT INTO evidence (tenant_id, test_id, sha256) VALUES ($1, $2, $3) RETURNING id',
    [tenantId, testId, sha256]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted evidence:', { id, testId, sha256 });
  return id;
}

async function upsertConclusion(
  client: Client,
  tenantId: string,
  testId: string,
  summary: string,
  overallResult: string = 'pass'
): Promise<string> {
  const existing = await client.query(
    'SELECT id FROM conclusions WHERE tenant_id = $1 AND test_id = $2',
    [tenantId, testId]
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
    [tenantId, testId, overallResult, summary]
  );
  const id = ins.rows[0].id;
  console.log('[seed] inserted conclusion:', { id, testId, overall_result: overallResult, summary });
  return id;
}

async function addGapData(
  client: Client,
  tenantId: string,
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
      [tenantId, title]
    );
    if (existing.rows.length > 0) {
      console.log('[seed] gap risk already exists:', { id: existing.rows[0].id, title });
      continue;
    }
    const ins = await client.query(
      'INSERT INTO risks (tenant_id, scope_id, title, assertion, rmm_level) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [tenantId, scopeId, title, null, null]
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
    const isoFrameworkId = await upsertFramework(client, TENANT_ID, 'ISO 27001', 'Information security management');
    const socFrameworkId = await upsertFramework(client, TENANT_ID, 'SOC 2 Type II', 'Service organization controls');

    // 2. Audit Scopes (4)
    const accessControlScopeId = await upsertAuditScope(client, TENANT_ID, isoFrameworkId, 'Access Control');
    const incidentMgmtScopeId = await upsertAuditScope(client, TENANT_ID, isoFrameworkId, 'Incident Management');
    const availabilityScopeId = await upsertAuditScope(client, TENANT_ID, socFrameworkId, 'Availability');
    const confidentialityScopeId = await upsertAuditScope(client, TENANT_ID, socFrameworkId, 'Confidentiality');

    // 3. Risks (6)
    const risk1Id = await upsertRisk(client, TENANT_ID, accessControlScopeId, 'Unauthorized Access');
    const risk2Id = await upsertRisk(client, TENANT_ID, accessControlScopeId, 'Privilege Escalation');
    const risk3Id = await upsertRisk(client, TENANT_ID, incidentMgmtScopeId, 'Slow Incident Response');
    const risk4Id = await upsertRisk(client, TENANT_ID, availabilityScopeId, 'System Downtime');
    const risk5Id = await upsertRisk(client, TENANT_ID, confidentialityScopeId, 'Data Breach');
    const risk6Id = await upsertRisk(client, TENANT_ID, confidentialityScopeId, 'Insider Threat');

    // 4. Controls (6, one per risk)
    const ctrl1Id = await upsertControl(client, TENANT_ID, risk1Id, 'CTRL-001', 'continuous', 'preventive');
    const ctrl2Id = await upsertControl(client, TENANT_ID, risk2Id, 'CTRL-002', 'monthly', 'preventive');
    const ctrl3Id = await upsertControl(client, TENANT_ID, risk3Id, 'CTRL-003', 'quarterly', 'detective');
    const ctrl4Id = await upsertControl(client, TENANT_ID, risk4Id, 'CTRL-004', 'continuous', 'preventive');
    const ctrl5Id = await upsertControl(client, TENANT_ID, risk5Id, 'CTRL-005', 'continuous', 'preventive');
    const ctrl6Id = await upsertControl(client, TENANT_ID, risk6Id, 'CTRL-006', 'daily', 'detective');

    // 5. Tests (6, one per control)
    const test1Id = await upsertTest(client, TENANT_ID, ctrl1Id, ['Verify MFA is enabled for all users', 'Check MFA enrollment status in IAM'], 10);
    const test2Id = await upsertTest(client, TENANT_ID, ctrl2Id, ['Review role assignments', 'Verify least privilege access'], 10);
    const test3Id = await upsertTest(client, TENANT_ID, ctrl3Id, ['Review incident response playbook', 'Verify escalation procedures'], 10);
    const test4Id = await upsertTest(client, TENANT_ID, ctrl4Id, ['Verify redundancy configuration', 'Check failover procedures'], 10);
    const test5Id = await upsertTest(client, TENANT_ID, ctrl5Id, ['Verify encryption at rest', 'Check key management'], 10);
    const test6Id = await upsertTest(client, TENANT_ID, ctrl6Id, ['Review activity logs', 'Verify monitoring coverage'], 10);

    // 6. Evidence (3)
    await upsertEvidence(client, TENANT_ID, test1Id, 'abc123');
    await upsertEvidence(client, TENANT_ID, test2Id, 'def456');
    await upsertEvidence(client, TENANT_ID, test5Id, 'ghi789');

    // 7. Conclusions (2)
    await upsertConclusion(client, TENANT_ID, test1Id, 'MFA is enabled for all sampled users', 'pass');
    await upsertConclusion(client, TENANT_ID, test2Id, 'Role-based access is properly configured', 'pass');

    // 8. Gap data (risks without controls)
    await addGapData(client, TENANT_ID, accessControlScopeId, availabilityScopeId, confidentialityScopeId);

    // --- TechCorp BV tenant ---
    const techCorpRes = await client.query(
      "SELECT id FROM tenants WHERE name = 'TechCorp BV'"
    );
    let techCorpTenantId: string;
    if (techCorpRes.rows.length > 0) {
      techCorpTenantId = techCorpRes.rows[0].id;
      console.log('[seed] TechCorp BV tenant already exists:', { id: techCorpTenantId });
    } else {
      const ins = await client.query(
        "INSERT INTO tenants (id, name) VALUES (gen_random_uuid(), 'TechCorp BV') RETURNING id"
      );
      techCorpTenantId = ins.rows[0].id;
      console.log('[seed] inserted TechCorp BV tenant:', { id: techCorpTenantId });
    }

    await client.query("SELECT set_config('app.tenant_id', $1, true)", [techCorpTenantId]);

    // Frameworks (2)
    const iso27kId = await upsertFramework(client, techCorpTenantId, 'ISO 27001', 'Information Security Management');
    const nen7510Id = await upsertFramework(client, techCorpTenantId, 'NEN 7510', 'Healthcare Information Security');

    // Audit Scopes (4)
    const networkSecScopeId = await upsertAuditScope(client, techCorpTenantId, iso27kId, 'Network Security');
    const dataProtScopeId = await upsertAuditScope(client, techCorpTenantId, iso27kId, 'Data Protection');
    const patientDataScopeId = await upsertAuditScope(client, techCorpTenantId, nen7510Id, 'Patient Data Access');
    const medDeviceScopeId = await upsertAuditScope(client, techCorpTenantId, nen7510Id, 'Medical Device Security');

    // Risks (8, 2 per scope) - 2 without controls: Device Tampering, Firmware Vulnerability
    const riskNet1Id = await upsertRisk(client, techCorpTenantId, networkSecScopeId, 'Network Intrusion');
    const riskNet2Id = await upsertRisk(client, techCorpTenantId, networkSecScopeId, 'DDoS Attack');
    const riskData1Id = await upsertRisk(client, techCorpTenantId, dataProtScopeId, 'Data Leakage');
    const riskData2Id = await upsertRisk(client, techCorpTenantId, dataProtScopeId, 'Ransomware');
    const riskPatient1Id = await upsertRisk(client, techCorpTenantId, patientDataScopeId, 'Unauthorized Patient Access');
    const riskPatient2Id = await upsertRisk(client, techCorpTenantId, patientDataScopeId, 'Data Manipulation');
    const riskDevice1Id = await upsertRisk(client, techCorpTenantId, medDeviceScopeId, 'Device Tampering');
    const riskDevice2Id = await upsertRisk(client, techCorpTenantId, medDeviceScopeId, 'Firmware Vulnerability');

    // Controls (6) - leave Device Tampering and Firmware Vulnerability without controls
    const ctrlT1Id = await upsertControl(client, techCorpTenantId, riskNet1Id, 'CTRL-T001', 'continuous', 'preventive');
    const ctrlT2Id = await upsertControl(client, techCorpTenantId, riskNet2Id, 'CTRL-T002', 'continuous', 'preventive');
    const ctrlT3Id = await upsertControl(client, techCorpTenantId, riskData1Id, 'CTRL-T003', 'continuous', 'preventive');
    const ctrlT4Id = await upsertControl(client, techCorpTenantId, riskData2Id, 'CTRL-T004', 'daily', 'corrective');
    const ctrlT5Id = await upsertControl(client, techCorpTenantId, riskPatient1Id, 'CTRL-T005', 'continuous', 'detective');
    const ctrlT6Id = await upsertControl(client, techCorpTenantId, riskPatient2Id, 'CTRL-T006', 'daily', 'detective');

    // Tests (6, one per control)
    const testT1Id = await upsertTest(client, techCorpTenantId, ctrlT1Id, ['Review firewall rule set', 'Verify ingress/egress filtering', 'Check default deny policy'], 10);
    const testT2Id = await upsertTest(client, techCorpTenantId, ctrlT2Id, ['Verify DDoS mitigation service', 'Test traffic thresholds', 'Review incident response'], 10);
    const testT3Id = await upsertTest(client, techCorpTenantId, ctrlT3Id, ['Verify encryption at rest and in transit', 'Check key management procedures', 'Validate certificate chain'], 10);
    const testT4Id = await upsertTest(client, techCorpTenantId, ctrlT4Id, ['Verify backup schedule', 'Test restore procedure', 'Document recovery time'], 10);
    const testT5Id = await upsertTest(client, techCorpTenantId, ctrlT5Id, ['Review access logs', 'Verify audit trail completeness', 'Check retention policy'], 10);
    const testT6Id = await upsertTest(client, techCorpTenantId, ctrlT6Id, ['Run integrity checks', 'Verify checksum validation', 'Document baseline'], 10);

    // Evidence (4) - link to tests 1, 3, 5, 4
    await upsertEvidence(client, techCorpTenantId, testT1Id, 'fw001');
    await upsertEvidence(client, techCorpTenantId, testT3Id, 'enc002');
    await upsertEvidence(client, techCorpTenantId, testT5Id, 'acc003');
    await upsertEvidence(client, techCorpTenantId, testT4Id, 'bak004');

    // Conclusions (3) - leave tests 4, 5, 6 without conclusions
    await upsertConclusion(client, techCorpTenantId, testT1Id, 'Firewall rules are properly configured', 'pass');
    await upsertConclusion(client, techCorpTenantId, testT2Id, 'DDoS protection is active and tested', 'pass');
    await upsertConclusion(client, techCorpTenantId, testT3Id, 'Data encryption meets compliance requirements', 'pass');

    console.log('[seed] TechCorp BV data complete');

    // --- FinanceSecure NV tenant ---
    const financeSecureRes = await client.query(
      "SELECT id FROM tenants WHERE name = 'FinanceSecure NV'"
    );
    let financeSecureTenantId: string;
    if (financeSecureRes.rows.length > 0) {
      financeSecureTenantId = financeSecureRes.rows[0].id;
      console.log('[seed] FinanceSecure NV tenant already exists:', { id: financeSecureTenantId });
    } else {
      const ins = await client.query(
        "INSERT INTO tenants (id, name) VALUES (gen_random_uuid(), 'FinanceSecure NV') RETURNING id"
      );
      financeSecureTenantId = ins.rows[0].id;
      console.log('[seed] inserted FinanceSecure NV tenant:', { id: financeSecureTenantId });
    }

    await client.query("SELECT set_config('app.tenant_id', $1, true)", [financeSecureTenantId]);

    // Frameworks (2)
    const soxId = await upsertFramework(client, financeSecureTenantId, 'SOX', 'Sarbanes-Oxley Financial Controls');
    const pciId = await upsertFramework(client, financeSecureTenantId, 'PCI DSS', 'Payment Card Industry Security');

    // Audit Scopes (4)
    const finReportingScopeId = await upsertAuditScope(client, financeSecureTenantId, soxId, 'Financial Reporting');
    const itGenControlsScopeId = await upsertAuditScope(client, financeSecureTenantId, soxId, 'IT General Controls');
    const cardDataScopeId = await upsertAuditScope(client, financeSecureTenantId, pciId, 'Card Data Environment');
    const accessMgmtScopeId = await upsertAuditScope(client, financeSecureTenantId, pciId, 'Access Management');

    // Risks (8, 2 per scope) - 3 without controls: Segregation of Duties, Unencrypted Transmission, Dormant Accounts
    const riskFin1Id = await upsertRisk(client, financeSecureTenantId, finReportingScopeId, 'Financial Fraud');
    const riskFin2Id = await upsertRisk(client, financeSecureTenantId, finReportingScopeId, 'Misstatement');
    const riskIt1Id = await upsertRisk(client, financeSecureTenantId, itGenControlsScopeId, 'Change Management Failure');
    const riskIt2Id = await upsertRisk(client, financeSecureTenantId, itGenControlsScopeId, 'Segregation of Duties Violation');
    const riskCard1Id = await upsertRisk(client, financeSecureTenantId, cardDataScopeId, 'Cardholder Data Breach');
    const riskCard2Id = await upsertRisk(client, financeSecureTenantId, cardDataScopeId, 'Unencrypted Transmission');
    const riskAcc1Id = await upsertRisk(client, financeSecureTenantId, accessMgmtScopeId, 'Excessive Privileges');
    const riskAcc2Id = await upsertRisk(client, financeSecureTenantId, accessMgmtScopeId, 'Dormant Accounts');

    // Controls (5) - leave Segregation of Duties, Unencrypted Transmission, Dormant Accounts without controls
    const ctrlF1Id = await upsertControl(client, financeSecureTenantId, riskFin1Id, 'CTRL-F001', 'monthly', 'detective');
    const ctrlF2Id = await upsertControl(client, financeSecureTenantId, riskFin2Id, 'CTRL-F002', 'daily', 'preventive');
    const ctrlF3Id = await upsertControl(client, financeSecureTenantId, riskIt1Id, 'CTRL-F003', 'monthly', 'preventive');
    const ctrlF4Id = await upsertControl(client, financeSecureTenantId, riskCard1Id, 'CTRL-F004', 'continuous', 'preventive');
    const ctrlF5Id = await upsertControl(client, financeSecureTenantId, riskAcc1Id, 'CTRL-F005', 'quarterly', 'detective');

    // Tests (5, one per control)
    const testF1Id = await upsertTest(client, financeSecureTenantId, ctrlF1Id, ['Review financial close process', 'Verify management review sign-off', 'Check variance analysis documentation'], 15);
    const testF2Id = await upsertTest(client, financeSecureTenantId, ctrlF2Id, ['Verify automated reconciliation runs', 'Test exception handling', 'Validate reconciliation timeliness'], 15);
    const testF3Id = await upsertTest(client, financeSecureTenantId, ctrlF3Id, ['Review CAB meeting minutes', 'Verify change approval workflow', 'Check change documentation completeness'], 15);
    const testF4Id = await upsertTest(client, financeSecureTenantId, ctrlF4Id, ['Verify encryption in transit (TLS)', 'Check key management procedures', 'Validate PCI encryption scope'], 15);
    const testF5Id = await upsertTest(client, financeSecureTenantId, ctrlF5Id, ['Review privileged access list', 'Verify quarterly attestation', 'Check access recertification process'], 15);

    // Evidence (3) - sox001, pci002, rec003
    await upsertEvidence(client, financeSecureTenantId, testF1Id, 'sox001');
    await upsertEvidence(client, financeSecureTenantId, testF4Id, 'pci002');
    await upsertEvidence(client, financeSecureTenantId, testF2Id, 'rec003');

    // Conclusions (2) - Test 1 pass, Test 2 fail; leave 3 without
    await upsertConclusion(client, financeSecureTenantId, testF1Id, 'Financial review process is operating effectively', 'pass');
    await upsertConclusion(client, financeSecureTenantId, testF2Id, 'Reconciliation gaps found in Q3 reporting period', 'fail');

    console.log('[seed] FinanceSecure NV data complete');

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
