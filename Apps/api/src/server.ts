import Fastify from 'fastify';
import { getTenantFromHeader } from './tenant';

const server = Fastify({ logger: true });

server.get('/health', async () => ({ ok: true }));

server.get('/tenant', async (request, reply) => {
  const tenantHeader = request.headers['x-tenant-id'];
  const tenant = getTenantFromHeader(tenantHeader as string | undefined);
  return { tenant: tenant ?? null };
});

const port = Number(process.env.PORT) || 3000;

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
