import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { z } from 'zod';
import { tenantMiddleware } from './middleware/tenant';
import { registerRoutes } from './routes';

const healthSchema = z.object({ ok: z.literal(true) });
type HealthResponse = z.infer<typeof healthSchema>;

const server = Fastify({ logger: true });

server.decorate('tenantMiddleware', tenantMiddleware);

server.get('/health', async (): Promise<HealthResponse> => {
  const response = { ok: true as const };
  healthSchema.parse(response);
  return response;
});

const port = Number(process.env.PORT) || 3001;
async function start() {
  await server.register(cors, { origin: true });
  await registerRoutes(server);
  try {
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();

export { server };
