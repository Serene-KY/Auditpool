import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const postBodySchema = z.object({
  test_id: z.string().uuid(),
  conclusion: z.string().min(1),
});

export async function registerConclusionsRoutes(app: FastifyInstance) {
  app.get('/conclusions', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db || !request.tenantId) {
      return reply.status(400).send({ error: 'Missing tenant context' });
    }
    try {
      const { rows } = await request.db.query(
        `SELECT id, tenant_id, test_id, conclusion, created_at, created_by, updated_at, updated_by, version
         FROM conclusions WHERE tenant_id = $1 AND (is_deleted = false OR is_deleted IS NULL)
         ORDER BY created_at DESC`,
        [request.tenantId]
      );
      return reply.send(rows);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch conclusions' });
    }
  });

  app.post('/conclusions', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
    const { test_id, conclusion } = parsed.data;
    try {
      const { rows } = await request.db.query(
        `INSERT INTO conclusions (tenant_id, test_id, conclusion)
         VALUES ($1, $2, $3)
         RETURNING id, tenant_id, test_id, conclusion, created_at, created_by, updated_at, updated_by, version`,
        [request.tenantId, test_id, conclusion]
      );
      return reply.status(201).send(rows[0]);
    } catch (err: unknown) {
      request.log.error(err);
      const pgErr = err as { code?: string };
      if (pgErr.code === '23503') {
        return reply.status(400).send({ error: 'Test not found' });
      }
      return reply.status(500).send({ error: 'Failed to create conclusion' });
    }
  });
}
