import Fastify from 'fastify';
import { pool } from './db';
import { requireTenant } from './tenant';

const server = Fastify({ logger: true });

// Health check
server.get('/health', async () => ({ ok: true }));

// Frameworks endpoint (minimal working version)
server.get('/frameworks', async (request, reply) => {
  try {
    const tenantId = requireTenant(request.headers['x-tenant-id'] as string | undefined);
    const client = await pool.connect();

    const result = await client.query('SELECT * FROM frameworks'); // simple query
    client.release();

    return result.rows;
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Start server
const port = Number(process.env.PORT) || 3000;
server.listen({ port, host: '0.0.0.0' })
  .then(() => console.log(`API running on http://localhost:${port}`))
  .catch(err => console.error(err));

export { server };