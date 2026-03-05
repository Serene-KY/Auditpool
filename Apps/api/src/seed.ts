import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const TENANT_ID = '69c1bc8b-63d9-4753-97ce-7fa2be21e41d';

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
    const tenantRes = await client.query(
      'SELECT id FROM tenants WHERE id = $1',
      [TENANT_ID]
    );
    if (tenantRes.rows.length === 0) {
      await client.query(
        'INSERT INTO tenants (id, name) VALUES ($1, $2)',
        [TENANT_ID, 'Seed Tenant']
      );
      console.log('[seed] inserted tenant:', TENANT_ID);
    }

    // 1. Framework
    let frameworkId: string;
    const fwRes = await client.query(
      `SELECT id FROM frameworks WHERE tenant_id = $1 AND name = $2`,
      [TENANT_ID, 'ISO 27001']
    );
    if (fwRes.rows.length > 0) {
      frameworkId = fwRes.rows[0].id;
      console.log('[seed] framework already exists:', frameworkId);
    } else {
      const ins = await client.query(
        `INSERT INTO frameworks (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id`,
        [TENANT_ID, 'ISO 27001', 'Information security management']
      );
      frameworkId = ins.rows[0].id;
      console.log('[seed] inserted framework:', { id: frameworkId, name: 'ISO 27001' });
    }

    // 2. Audit scope
    let auditScopeId: string;
    const asRes = await client.query(
      `SELECT id FROM audit_scopes WHERE tenant_id = $1 AND name = $2`,
      [TENANT_ID, 'Access Control']
    );
    if (asRes.rows.length > 0) {
      auditScopeId = asRes.rows[0].id;
      console.log('[seed] audit_scope already exists:', auditScopeId);
    } else {
      const ins = await client.query(
        `INSERT INTO audit_scopes (tenant_id, framework_id, name) VALUES ($1, $2, $3) RETURNING id`,
        [TENANT_ID, frameworkId, 'Access Control']
      );
      auditScopeId = ins.rows[0].id;
      console.log('[seed] inserted audit_scope:', { id: auditScopeId, name: 'Access Control' });
    }

    // 3. Risk
    let riskId: string;
    const riskRes = await client.query(
      `SELECT id FROM risks WHERE tenant_id = $1 AND title = $2`,
      [TENANT_ID, 'Unauthorized Access']
    );
    if (riskRes.rows.length > 0) {
      riskId = riskRes.rows[0].id;
      console.log('[seed] risk already exists:', riskId);
    } else {
      const ins = await client.query(
        `INSERT INTO risks (tenant_id, scope_id, title, assertion, rmm_level, significant) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [TENANT_ID, auditScopeId, 'Unauthorized Access', 'completeness', 'high', true]
      );
      riskId = ins.rows[0].id;
      console.log('[seed] inserted risk:', { id: riskId, title: 'Unauthorized Access' });
    }

    // 4. Control
    let controlId: string;
    const ctrlRes = await client.query(
      `SELECT id FROM controls WHERE tenant_id = $1 AND control_code = $2`,
      [TENANT_ID, 'CTRL-001']
    );
    if (ctrlRes.rows.length > 0) {
      controlId = ctrlRes.rows[0].id;
      console.log('[seed] control already exists:', controlId);
    } else {
      const ins = await client.query(
        `INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [TENANT_ID, riskId, 'CTRL-001', 'continuous', 'preventive']
      );
      controlId = ins.rows[0].id;
      console.log('[seed] inserted control:', { id: controlId, control_code: 'CTRL-001' });
    }

    // 5. Test
    const procedureSteps = JSON.stringify(['Verify MFA is enabled for all users']);
    const testRes = await client.query(
      `SELECT id FROM tests WHERE tenant_id = $1 AND control_id = $2 AND procedure_steps = $3::jsonb`,
      [TENANT_ID, controlId, procedureSteps]
    );
    if (testRes.rows.length > 0) {
      console.log('[seed] test already exists:', testRes.rows[0].id);
    } else {
      const ins = await client.query(
        `INSERT INTO tests (tenant_id, control_id, test_type, procedure_steps, sample_size) VALUES ($1, $2, $3, $4::jsonb, $5) RETURNING id`,
        [TENANT_ID, controlId, 'manual', procedureSteps, 10]
      );
      console.log('[seed] inserted test:', { id: ins.rows[0].id, procedure_steps: 'Verify MFA is enabled for all users' });
    }

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
