import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { pool } from '../db';

export async function registerTenantsRoutes(app: FastifyInstance) {
  app.get('/tenants', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { rows } = await pool.query(
        `SELECT id, name, created_at FROM tenants ORDER BY name ASC`
      );
      return reply.send(rows);
    } catch (err) {
      request.log.error(err);
      const message = err instanceof Error ? err.message : 'Failed to fetch tenants';
      return reply.status(500).send({ error: message });
    }
  });
}
