import 'dotenv/config';
import Fastify from 'fastify';
import { z } from 'zod';

const healthSchema = z.object({ ok: z.literal(true) });
type HealthResponse = z.infer<typeof healthSchema>;

const server = Fastify({ logger: true });

server.get('/health', async (): Promise<HealthResponse> => {
  const response = { ok: true as const };
  healthSchema.parse(response);
  return response;
});

const port = Number(process.env.PORT) || 3001;
async function start() {
  try {
    await server.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();

export { server };
