import type { FastifyInstance, FastifyReply } from 'fastify';
import { listTools } from '../mcp/server';

export async function registerMcpRoutes(app: FastifyInstance) {
  app.get('/mcp/tools', async (_request, reply: FastifyReply) => {
    const tools = listTools();
    return reply.send({ tools });
  });
}
