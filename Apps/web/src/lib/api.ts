const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const TENANT_ID = '69c1bc8b-63d9-4753-97ce-7fa2be21e41d';

const headers = {
  'Content-Type': 'application/json',
  'x-tenant-id': TENANT_ID,
};

export async function fetchResource<T>(resource: string): Promise<T[]> {
  const res = await fetch(`${API_URL}/${resource}`, { headers });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function createResource<T>(
  resource: string,
  body: Record<string, unknown>
): Promise<T> {
  const res = await fetch(`${API_URL}/${resource}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}

export interface ReviewEvidenceResult {
  sufficient: boolean;
  reasoning: string;
  recommendations: string[];
}

export async function reviewEvidence(testId: string): Promise<ReviewEvidenceResult> {
  const res = await fetch(`${API_URL}/ai/review-evidence`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ test_id: testId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API error: ${res.status}`);
  }
  return res.json();
}
