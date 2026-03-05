import { FastifyRequest } from 'fastify';

export type TenantId = string;

export function getTenantFromHeader(header: string | undefined): TenantId | null {
  if (!header) return null;
  const trimmed = header.trim();
  return trimmed || null;
}

export class TenantRequiredError extends Error {
  readonly statusCode = 400;
  constructor() {
    super('Tenant header required');
    this.name = 'TenantRequiredError';
  }
}

export function requireTenant(header: string | undefined): TenantId {
  const tenant = getTenantFromHeader(header);
  if (!tenant) throw new TenantRequiredError();
  return tenant;
}

export async function setTenantContext(request: FastifyRequest): Promise<void> {
  const tenantId = requireTenant(request.headers['x-tenant-id'] as string | undefined);
  (request as FastifyRequest & { tenantId: TenantId }).tenantId = tenantId;
}
