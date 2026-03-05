import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const postBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  audit_scope_id: z.string().uuid(),
});

export async function registerRisksRoutes(app: FastifyInstance) {
  app.get('/risks', { preHandler: [app.tenantMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.db || !request.tenantId) {
      return reply.status(400).send({ error: 'Missing tenant context' });
    }
    try {
      const { rows } = await request.db.query(
        `SELECT * FROM risks WHERE tenant_id = $1`,
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
    const { name, description, audit_scope_id } = parsed.data;
    try {
      const { rows } = await request.db.query(
        `INSERT INTO risks (tenant_id, audit_scope_id, name, description) VALUES ($1, $2, $3, $4) RETURNING id`,
        [request.tenantId, audit_scope_id, name, description ?? null]
      );
      return reply.status(201).send(rows[0]);
    } catch (err: unknown) {
      request.log.error(err);
      const pgErr = err as { code?: string };
      if (pgErr.code === '23503') {
        return reply.status(400).send({ error: 'Audit scope not found' });
      }
      return reply.status(500).send({ error: 'Failed to create risk' });
    }
  });
}
