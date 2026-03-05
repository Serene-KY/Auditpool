import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { listTools } from '../mcp/server';
import { preparerAgent } from '../mcp/agent';

export async function registerMcpRoutes(app: FastifyInstance) {
  app.get('/mcp/tools', async (_request, reply: FastifyReply) => {
    const tools = listTools();
    return reply.send({ tools });
  });

  app.post(
    '/mcp/prepare',
    { preHandler: [app.tenantMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.db || !request.tenantId) {
        return reply.status(400).send({ error: 'Missing tenant context (x-tenant-id header)' });
      }
      try {
        const data = await preparerAgent(request.db, request.tenantId);
        return reply.send(data);
      } catch (err) {
        request.log.error(err);
        const message = err instanceof Error ? err.message : 'Prepare failed';
        return reply.status(500).send({ error: message });
      }
    }
  );
}
