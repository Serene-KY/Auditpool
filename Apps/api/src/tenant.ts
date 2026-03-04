export type TenantId = string;

export function getTenantFromHeader(header: string | undefined): TenantId | null {
  if (!header) return null;
  const trimmed = header.trim();
  return trimmed || null;
}

export function requireTenant(header: string | undefined): TenantId {
  const tenant = getTenantFromHeader(header);
  if (!tenant) throw new Error('Tenant header required');
  return tenant;
}
