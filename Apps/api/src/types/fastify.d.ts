import type { FastifyRequest, FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    tenantMiddleware: (
      request: FastifyRequest,
      reply: FastifyReply
    ) => Promise<void>;
  }
}
