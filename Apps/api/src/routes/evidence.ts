import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const postBodySchema = z.object({
  test_id: z.string().uuid(),
  sha256: z.string().min(1),
});

export async function registerEvidenceRoutes(app: FastifyInstance) {
  app.get('/evidence', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db || !request.tenantId) {
      return reply.status(400).send({ error: 'Missing tenant context' });
    }
    try {
      const { rows } = await request.db.query(
        `SELECT * FROM evidence WHERE tenant_id = $1`,
        [request.tenantId]
      );
      return reply.send(rows);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch evidence' });
    }
  });

  app.post('/evidence', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
    const { test_id, sha256 } = parsed.data;
    try {
      const { rows } = await request.db.query(
        `INSERT INTO evidence (tenant_id, test_id, sha256) VALUES ($1, $2, $3) RETURNING id`,
        [request.tenantId, test_id, sha256]
      );
      return reply.status(201).send(rows[0]);
    } catch (err: unknown) {
      request.log.error(err);
      const pgErr = err as { code?: string };
      if (pgErr.code === '23503') {
        return reply.status(400).send({ error: 'Test not found' });
      }
      if (pgErr.code === '23505') {
        return reply.status(409).send({ error: 'Evidence with same sha256 for this test already exists' });
      }
      return reply.status(500).send({ error: 'Failed to create evidence' });
    }
  });
}
