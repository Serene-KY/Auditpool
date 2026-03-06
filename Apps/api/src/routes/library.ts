import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db';
import { z } from 'zod';

const SYSTEM_TENANT_ID = '00000000-0000-0000-0000-000000000000';
const uuidSchema = z.string().uuid();

export async function registerLibraryRoutes(app: FastifyInstance) {
  app.get('/library/frameworks', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, description FROM frameworks WHERE tenant_id = $1 ORDER BY name ASC`,
        [SYSTEM_TENANT_ID]
      );
      return reply.send(rows);
    } catch (err) {
      request.log.error(err);
      const message = err instanceof Error ? err.message : 'Failed to fetch library frameworks';
      return reply.status(500).send({ error: message });
    }
  });

  app.post(
    '/library/frameworks/:frameworkId/import',
    async (request: FastifyRequest<{ Params: { frameworkId: string } }>, reply: FastifyReply) => {
      const header = request.headers['x-tenant-id'];
      if (!header || typeof header !== 'string') {
        return reply.status(400).send({ error: 'Missing x-tenant-id header' });
      }
      const tenantParsed = uuidSchema.safeParse(header);
      if (!tenantParsed.success) {
        return reply.status(400).send({ error: 'Invalid x-tenant-id: must be a valid UUID' });
      }
      const targetTenantId = tenantParsed.data;

      const frameworkParsed = uuidSchema.safeParse(request.params.frameworkId);
      if (!frameworkParsed.success) {
        return reply.status(400).send({ error: 'Invalid frameworkId: must be a valid UUID' });
      }
      const sourceFrameworkId = frameworkParsed.data;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        // 1. Fetch source framework
        const fwRes = await client.query(
          'SELECT id, name, description FROM frameworks WHERE id = $1 AND tenant_id = $2',
          [sourceFrameworkId, SYSTEM_TENANT_ID]
        );
        if (fwRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(404).send({ error: 'Framework not found in library' });
        }
        const srcFw = fwRes.rows[0];

        // 2. Check target tenant exists
        const tenantRes = await client.query('SELECT id FROM tenants WHERE id = $1', [targetTenantId]);
        if (tenantRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return reply.status(400).send({ error: 'Tenant not found' });
        }

        // 3. Check if framework with same name already exists for tenant
        const existingRes = await client.query(
          'SELECT id FROM frameworks WHERE tenant_id = $1 AND name = $2',
          [targetTenantId, srcFw.name]
        );
        if (existingRes.rows.length > 0) {
          await client.query('ROLLBACK');
          return reply.status(409).send({
            error: `Framework "${srcFw.name}" already exists for this tenant`,
            frameworkId: existingRes.rows[0].id,
          });
        }

        // 4. Insert new framework
        const insFw = await client.query(
          'INSERT INTO frameworks (tenant_id, name, description) VALUES ($1, $2, $3) RETURNING id',
          [targetTenantId, srcFw.name, srcFw.description ?? null]
        );
        const newFrameworkId = insFw.rows[0].id;

        // 5. Fetch and copy audit scopes
        const scopesRes = await client.query(
          'SELECT id, name FROM audit_scopes WHERE framework_id = $1',
          [sourceFrameworkId]
        );
        const scopeIdMap: Record<string, string> = {};
        for (const row of scopesRes.rows) {
          const insScope = await client.query(
            'INSERT INTO audit_scopes (tenant_id, framework_id, name) VALUES ($1, $2, $3) RETURNING id',
            [targetTenantId, newFrameworkId, row.name]
          );
          scopeIdMap[row.id] = insScope.rows[0].id;
        }

        // 6. Detect scope column: scope_id vs audit_scope_id
        const colCheck = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'risks' AND column_name IN ('scope_id', 'audit_scope_id')`
        );
        const scopeCol = colCheck.rows.some((r: { column_name: string }) => r.column_name === 'scope_id')
          ? 'scope_id'
          : 'audit_scope_id';

        // 7. Fetch and copy risks (only those in our framework's scopes)
        const sourceScopeIds = scopesRes.rows.map((r: { id: string }) => r.id);
        const risksRes = await client.query(
          `SELECT id, ${scopeCol} as scope_id, COALESCE(title, name) as title, assertion, rmm_level FROM risks WHERE tenant_id = $1 AND ${scopeCol} = ANY($2::uuid[])`,
          [SYSTEM_TENANT_ID, sourceScopeIds]
        );
        const riskIdMap: Record<string, string> = {};
        for (const row of risksRes.rows) {
          const oldScopeId = row.scope_id;
          const newScopeId = scopeIdMap[oldScopeId];
          if (!newScopeId) continue;
          const title = row.title ?? row.name ?? 'Unnamed risk';
          const insRisk = await client.query(
            `INSERT INTO risks (tenant_id, ${scopeCol}, title, assertion, rmm_level) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [targetTenantId, newScopeId, title, row.assertion ?? null, row.rmm_level ?? null]
          );
          riskIdMap[row.id] = insRisk.rows[0].id;
        }

        // 8. Fetch and copy controls (only for risks we copied)
        const sourceRiskIds = risksRes.rows.map((r: { id: string }) => r.id);
        const controlsRes =
          sourceRiskIds.length > 0
            ? await client.query(
                'SELECT id, risk_id, control_code, frequency, control_type, description FROM controls WHERE tenant_id = $1 AND risk_id = ANY($2::uuid[])',
                [SYSTEM_TENANT_ID, sourceRiskIds]
              )
            : { rows: [] };
        const descCheck = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'controls' AND column_name = 'description'`
        );
        const hasDesc = descCheck.rows.length > 0;
        const controlCodeCheck = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'controls' AND column_name = 'control_code'`
        );
        const hasControlCode = controlCodeCheck.rows.length > 0;

        for (const row of controlsRes.rows) {
          const newRiskId = riskIdMap[row.risk_id];
          if (!newRiskId) continue;
          const ctrlCode = (row as { control_code?: string }).control_code ?? 'CTRL';
          const ctrlFreq = (row as { frequency?: string }).frequency ?? 'continuous';
          const ctrlType = (row as { control_type?: string }).control_type ?? 'preventive';
          const ctrlDesc = (row as { description?: string }).description ?? null;
          if (hasControlCode) {
            if (hasDesc) {
              await client.query(
                'INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type, description) VALUES ($1, $2, $3, $4, $5, $6)',
                [targetTenantId, newRiskId, ctrlCode, ctrlFreq, ctrlType, ctrlDesc]
              );
            } else {
              await client.query(
                'INSERT INTO controls (tenant_id, risk_id, control_code, frequency, control_type) VALUES ($1, $2, $3, $4, $5)',
                [targetTenantId, newRiskId, ctrlCode, ctrlFreq, ctrlType]
              );
            }
          } else {
            await client.query(
              'INSERT INTO controls (tenant_id, risk_id, name, description) VALUES ($1, $2, $3, $4)',
              [targetTenantId, newRiskId, ctrlCode, ctrlDesc]
            );
          }
        }

        await client.query('COMMIT');
        return reply.send({ imported: true, frameworkId: newFrameworkId });
      } catch (err) {
        await client.query('ROLLBACK');
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Import failed';
        return reply.status(500).send({ error: message });
      } finally {
        client.release();
      }
    }
  );
}
