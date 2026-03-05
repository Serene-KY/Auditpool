import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const postBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  control_id: z.string().uuid(),
});

export async function registerTestsRoutes(app: FastifyInstance) {
  app.get('/tests', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db || !request.tenantId) {
      return reply.status(400).send({ error: 'Missing tenant context' });
    }
    try {
      const { rows } = await request.db.query(
        `SELECT * FROM tests WHERE tenant_id = $1`,
        [request.tenantId]
      );
      return reply.send(rows);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({ error: 'Failed to fetch tests' });
    }
  });

  app.post('/tests', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
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
    const { name, description, control_id } = parsed.data;
    try {
      const { rows } = await request.db.query(
        `INSERT INTO tests (tenant_id, control_id, name, description) VALUES ($1, $2, $3, $4) RETURNING id`,
        [request.tenantId, control_id, name, description ?? null]
      );
      return reply.status(201).send(rows[0]);
    } catch (err: unknown) {
      request.log.error(err);
      const pgErr = err as { code?: string };
      if (pgErr.code === '23503') {
        return reply.status(400).send({ error: 'Control not found' });
      }
      return reply.status(500).send({ error: 'Failed to create test' });
    }
  });
}
