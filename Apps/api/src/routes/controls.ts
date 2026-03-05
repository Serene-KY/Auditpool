import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const postBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  risk_id: z.string().uuid(),
});

export async function registerControlsRoutes(app: FastifyInstance) {
  app.get('/controls', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db || !request.tenantId) {
      return reply.status(400).send({ error: 'Missing tenant context' });
    }
    try {
      const { rows } = await request.db.query(
        `SELECT id, tenant_id, risk_id, name, description, created_at, created_by, updated_at, updated_by, version
         FROM controls WHERE tenant_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
         ORDER BY created_at DESC`,
        [request.tenantId]
      );
      return reply.send(rows);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch controls' });
    }
  });

  app.post('/controls', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db || !request.tenantId) {
      return reply.status(400).send({ error: 'Missing tenant context' });
    }
    const parsed = postBodySchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: parsed.error.flatten(),
      });
    }
    const { name, description, risk_id } = parsed.data;
    try {
      const { rows } = await request.db.query(
        `INSERT INTO controls (tenant_id, risk_id, name, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id, tenant_id, risk_id, name, description, created_at, created_by, updated_at, updated_by, version`,
        [request.tenantId, risk_id, name, description ?? null]
      );
      return reply.status(201).send(rows[0]);
    } catch (err: unknown) {
      request.log.error(err);
      const pgErr = err as { code?: string };
      if (pgErr.code === '23503') {
        return reply.status(400).send({ error: 'Risk not found' });
      }
      return reply.status(500).send({ error: 'Failed to create control' });
    }
  });
}
