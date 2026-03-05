import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PoolClient } from 'pg';
import { pool } from '../db';
import { z } from 'zod';

const uuidSchema = z.string().uuid();

export interface TenantRequest {
  tenantId: string;
  db: PoolClient;
}

declare module 'fastify' {
  interface FastifyRequest {
    tenantId?: string;
    db?: PoolClient;
  }
}

export async function tenantMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const header = request.headers['x-tenant-id'];
  if (!header || typeof header !== 'string') {
    return reply.status(400).send({ error: 'Missing x-tenant-id header' });
  }

  const parsed = uuidSchema.safeParse(header);
  if (!parsed.success) {
    return reply.status(400).send({
      error: 'Invalid x-tenant-id: must be a valid UUID',
      details: parsed.error.flatten(),
    });
  }

  const tenantId = parsed.data;
  let client: PoolClient;

  try {
    client = await pool.connect();
  } catch (err) {
    request.log.error(err, 'Failed to acquire db client');
    return reply.status(503).send({ error: 'Database unavailable' });
  }

  try {
    await client.query('SELECT set_tenant_context($1::uuid)', [tenantId]);
  } catch (err) {
    client.release();
    request.log.error(err, 'Failed to set tenant context');
    return reply.status(503).send({ error: 'Database error' });
  }

  request.tenantId = tenantId;
  request.db = client;

  reply.raw.on('finish', () => {
    if (request.db) {
      const db = request.db;
      (request as FastifyRequest & { db?: PoolClient }).db = undefined;
      db.release();
    }
  });
}
