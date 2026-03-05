import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';

const postBodySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
});

export async function registerFrameworksRoutes(app: FastifyInstance) {
  app.get(
    '/frameworks',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.db || !request.tenantId) {
        return reply.status(400).send({ error: 'Missing tenant context' });
      }
      try {
        const { rows } = await request.db.query(
          `SELECT id, tenant_id, name, description, created_at FROM frameworks WHERE tenant_id = $1 ORDER BY created_at DESC`,
          [request.tenantId]
        );
        return reply.send(rows);
      } catch (err) {
        console.error('frameworks error:', err);
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Failed to fetch frameworks';
        return reply.status(500).send({ error: message });
      }
    }
  );

  app.post(
    '/frameworks',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
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
      const { name, description } = parsed.data;
      try {
        const { rows } = await request.db.query(
          `INSERT INTO frameworks (id, tenant_id, name, description, created_at) VALUES (gen_random_uuid(), $1, $2, $3, NOW()) RETURNING id`,
          [request.tenantId, name, description ?? null]
        );
        return reply.status(201).send(rows[0]);
      } catch (err: unknown) {
        request.log.error(err);
        const pgErr = err as { code?: string };
        if (pgErr.code === '23503') {
          return reply.status(400).send({ error: 'Tenant not found' });
        }
        return reply.status(500).send({ error: 'Failed to create framework' });
      }
    }
  );
}
