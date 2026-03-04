import { FastifyRequest, FastifyReply } from "fastify";
import { pool } from "./db";

// Tenant type and helpers
export type TenantId = string;

export function getTenantFromHeader(header: string | undefined): TenantId | null {
  if (!header) return null;
  const trimmed = header.trim();
  return trimmed || null;
}

export function requireTenant(header: string | undefined): TenantId {
  const tenant = getTenantFromHeader(header);
  if (!tenant) throw new Error("Tenant header required");
  return tenant;
}

// Set tenant context per request
export async function setTenantContext(
  request: FastifyRequest,
  reply: FastifyReply
) {
  let client;
  try {
    const tenantId = requireTenant(request.headers["x-tenant-id"] as string | undefined);
    client = await pool.connect();

    await client.query("select set_tenant_context($1)", [tenantId]);
    request.decorate("dbClient", client); // attach client per request
  } catch (err) {
    if (client) client.release();
    return reply.status(400).send({ error: err instanceof Error ? err.message : "Unknown error" });
  }
}