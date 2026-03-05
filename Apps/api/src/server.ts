import Fastify from 'fastify';
import { getTenantFromHeader, setTenantContext } from './tenant';

const server = Fastify({ logger: true });

// Health endpoint
server.get('/health', async () => ({ ok: true }));

// Tenant info endpoint
server.get('/tenant', async (request, reply) => {
  const tenantHeader = request.headers['x-tenant-id'];
  const tenant = getTenantFromHeader(tenantHeader as string | undefined);
  return { tenant: tenant ?? null };
});

// Frameworks endpoint (requires tenant)
server.get('/frameworks', { preHandler: setTenantContext }, async (request) => {
  const client = (request as any).dbClient;
  try {
    const result = await client.query('SELECT * FROM frameworks');
    return result.rows;
  } finally {
    client.release();
  }

server.get('/frameworks', async (request, reply) => {
  try {
    // require tenant header but skip DB function
    const tenantId = requireTenant(request.headers['x-tenant-id'] as string | undefined);

    const client = await pool.connect();
    const result = await client.query('SELECT * FROM frameworks'); // simple query
    client.release();

    return result.rows;
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});
});

// Start server
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