import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    '/dashboard/stats',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.db || !request.tenantId) {
        return reply.status(400).send({ error: 'Missing tenant context (x-tenant-id header)' });
      }

      const tenantId = request.tenantId;

      try {
        const db = request.db;

        const [fwk, asc, rsk, ctrl, tst, evi, con, rwc, cwt] = await Promise.all([
          db.query('SELECT COUNT(*)::int AS c FROM frameworks WHERE tenant_id = $1', [tenantId]),
          db.query('SELECT COUNT(*)::int AS c FROM audit_scopes WHERE tenant_id = $1', [tenantId]),
          db.query('SELECT COUNT(*)::int AS c FROM risks WHERE tenant_id = $1', [tenantId]),
          db.query('SELECT COUNT(*)::int AS c FROM controls WHERE tenant_id = $1', [tenantId]),
          db.query('SELECT COUNT(*)::int AS c FROM tests WHERE tenant_id = $1', [tenantId]),
          db.query('SELECT COUNT(*)::int AS c FROM evidence WHERE tenant_id = $1', [tenantId]),
          db.query('SELECT COUNT(*)::int AS c FROM conclusions WHERE tenant_id = $1', [tenantId]),
          db.query(
            `SELECT COUNT(*)::int AS c FROM risks r WHERE r.tenant_id = $1 AND NOT EXISTS (SELECT 1 FROM controls c WHERE c.risk_id = r.id)`,
            [tenantId]
          ),
          db.query(
            `SELECT COUNT(*)::int AS c FROM controls c WHERE c.tenant_id = $1 AND NOT EXISTS (SELECT 1 FROM tests t WHERE t.control_id = c.id)`,
            [tenantId]
          ),
        ]);

        return reply.send({
          frameworkCount: fwk.rows[0]?.c ?? 0,
          auditScopeCount: asc.rows[0]?.c ?? 0,
          riskCount: rsk.rows[0]?.c ?? 0,
          controlCount: ctrl.rows[0]?.c ?? 0,
          testCount: tst.rows[0]?.c ?? 0,
          evidenceCount: evi.rows[0]?.c ?? 0,
          conclusionCount: con.rows[0]?.c ?? 0,
          risksWithoutControls: rwc.rows[0]?.c ?? 0,
          controlsWithoutTests: cwt.rows[0]?.c ?? 0,
          testsWithoutEvidence: 0,
        });
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to fetch stats';
        return reply.status(500).send({ error: message });
      }
    }
  );
}
