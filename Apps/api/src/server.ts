import Fastify from 'fastify';
import { getTenantFromHeader, requireTenant, setTenantContext } from './tenant';
import { supabase } from './db';

const server = Fastify({ logger: true });

// Return 400 for missing tenant, 500 for other errors
server.setErrorHandler((err, _request, reply) => {
  const statusCode = (err as { statusCode?: number }).statusCode ?? 500;
  void reply.status(statusCode).send({ error: err.message });
});

// Health endpoint
server.get('/health', async () => ({ ok: true }));

// Tenant info endpoint
server.get('/tenant', async (request) => {
  const tenantHeader = request.headers['x-tenant-id'];
  const tenant = getTenantFromHeader(tenantHeader as string | undefined);
  return { tenant: tenant ?? null };
});

// Frameworks endpoint (requires tenant) – via Supabase REST (geen directe Postgres-DNS nodig)
const frameworksHandler = async (request: any, reply: any) => {
  try {
    const { data, error } = await supabase.from('frameworks').select('*');
    if (error) return reply.status(500).send({ error: error.message });
    return data ?? [];
  } catch (err) {
    return reply.status(500).send({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
};
server.get('/framework', { preHandler: setTenantContext }, frameworksHandler);
server.get('/frameworks', { preHandler: setTenantContext }, frameworksHandler);

// Tenants endpoint (requires tenant header)
const tenantsHandler = async (request: any, reply: any) => {
  try {
    const { data, error } = await supabase.from('tenants').select('id, name');
    if (error) return reply.status(500).send({ error: error.message });
    return data ?? [];
  } catch (err) {
    return reply.status(500).send({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
};
server.get('/tenants', { preHandler: setTenantContext }, tenantsHandler);

// Create framework endpoint (Supabase)
server.post('/frameworks', async (request, reply) => {
  try {
    const tenantId = requireTenant(request.headers['x-tenant-id'] as string | undefined);
    const { name, description } = request.body as { name: string; description?: string };

    if (!name) {
      return reply.status(400).send({ error: 'Framework name is required' });
    }

    const { data, error } = await supabase
      .from('frameworks')
      .insert({ tenant_id: tenantId, name, description: description ?? null })
      .select()
      .single();

    if (error) return reply.status(500).send({ error: error.message });
    return data;
  } catch (err) {
    return reply.status(400).send({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
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
