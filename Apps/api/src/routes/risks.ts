import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const postBodySchema = z.object({
  scope_id: z.string().uuid(),
  title: z.string().min(1),
  assertion: z.string().optional(),
  rmm_level: z.string().optional(),
});

export async function registerRisksRoutes(app: FastifyInstance) {
  app.get('/risks', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db || !request.tenantId) {
      return reply.status(400).send({ error: 'Missing tenant context' });
    }
    try {
      const { rows } = await request.db.query(
        `SELECT id, tenant_id, scope_id, title, assertion, rmm_level, created_at FROM risks WHERE tenant_id = $1`,
        [request.tenantId]
      );
      return reply.send(rows);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch risks' });
    }
  });

  app.post('/risks', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
    const { scope_id, title, assertion, rmm_level } = parsed.data;
    try {
      const { rows } = await request.db.query(
        `INSERT INTO risks (tenant_id, scope_id, title, assertion, rmm_level) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [request.tenantId, scope_id, title, assertion ?? null, rmm_level ?? null]
      );
      return reply.status(201).send(rows[0]);
    } catch (err: unknown) {
      request.log.error(err);
      const pgErr = err as { code?: string };
      if (pgErr.code === '23503') {
        return reply.status(400).send({ error: 'Scope not found' });
      }
      return reply.status(500).send({ error: 'Failed to create risk' });
    }
  });
}
