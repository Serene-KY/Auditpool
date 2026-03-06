const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TENANT_ID = '69c1bc8b-63d9-4753-97ce-7fa2be21e41d';

const headers = {
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
};

function wrapFetchError(err: unknown, url: string): Error {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('Failed to fetch') || msg.includes('Load failed') || msg.includes('NetworkError')) {
    return new Error(`Cannot reach API at ${url}. Is the API server running? Try: cd apps/api && pnpm dev`);
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function fetchResource<T>(resource: string): Promise<T[]> {
  const url = `${API_URL}/${resource}`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}

export async function createResource<T>(
  resource: string,
  body: Record<string, unknown>
): Promise<T> {
  const url = `${API_URL}/${resource}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}

export interface ReviewEvidenceResult {
  sufficient: boolean;
  reasoning: string;
  recommendations: string[];
}

export interface PreparerResult {
  summary: string;
  suggestedControls: Array<{ riskId: string; controlCode: string; description?: string }>;
}

export interface Tenant {
  id: string;
  name: string;
  created_at?: string;
}

export async function fetchTenants(): Promise<Tenant[]> {
  const url = `${API_URL}/tenants`;
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}

function headersWithTenant(tenantId: string) {
  return { 'Content-Type': 'application/json' as const, 'x-tenant-id': tenantId };
}

export async function runPreparer(tenantId: string): Promise<PreparerResult> {
  const url = `${API_URL}/mcp/prepare`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: headersWithTenant(tenantId),
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}

export interface WorkflowStatus {
  current_stage: string;
  readiness_score: number;
  blocking_issues: Array<{
    type: string;
    scope_id?: string;
    risk_id?: string;
    control_id?: string;
    test_id?: string;
    message?: string;
  }>;
  can_advance: boolean;
  stage_requirements_met: Record<string, boolean>;
}

export async function fetchWorkflowStatus(
  tenantId: string,
  frameworkId: string
): Promise<WorkflowStatus> {
  const url = `${API_URL}/workflow/${frameworkId}/status`;
  try {
    const res = await fetch(url, { headers: headersWithTenant(tenantId) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}

export async function fetchFrameworks(tenantId: string): Promise<Array<{ id: string; name: string }>> {
  const url = `${API_URL}/frameworks`;
  try {
    const res = await fetch(url, { headers: headersWithTenant(tenantId) });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}

export interface DashboardStats {
  frameworkCount: number;
  auditScopeCount: number;
  riskCount: number;
  controlCount: number;
  testCount: number;
  evidenceCount: number;
  conclusionCount: number;
  risksWithoutControls: number;
  controlsWithoutTests: number;
  testsWithoutEvidence: number;
}

export async function fetchDashboardStats(tenantId: string): Promise<DashboardStats> {
  const url = `${API_URL}/dashboard/stats`;
  try {
    const res = await fetch(url, { headers: headersWithTenant(tenantId) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}

export async function reviewEvidence(testId: string): Promise<ReviewEvidenceResult> {
  const url = `${API_URL}/ai/review-evidence`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ test_id: testId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  } catch (err) {
    throw wrapFetchError(err, url);
  }
}
