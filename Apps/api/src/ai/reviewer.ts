import Groq from 'groq-sdk';
import type { PoolClient } from 'pg';
import { REVIEW_SYSTEM_PROMPT } from './prompts';

const MODEL = 'llama-3.3-70b-versatile';

export interface ReviewResult {
  sufficient: boolean;
  reasoning: string;
  recommendations: string[];
}

export interface ReviewOutput {
  result: ReviewResult;
  prompt: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface EvidenceRow {
  id: string;
  tenant_id: string;
  file_name: string | null;
  file_path: string | null;
  sha256: string;
  created_at?: string;
}

export interface TestRow {
  id: string;
  tenant_id: string;
  control_id: string;
  test_type: string | null;
  procedure_steps: unknown;
  sample_size: number | null;
  created_at?: string;
}

export async function reviewEvidence(
  db: PoolClient,
  tenantId: string,
  testId: string
): Promise<ReviewOutput> {
  const testRes = await db.query(
    `SELECT id, tenant_id, control_id, test_type, procedure_steps, sample_size, created_at FROM tests WHERE id = $1 AND tenant_id = $2`,
    [testId, tenantId]
  );

  const evidenceRes = await db.query(
    `SELECT id, tenant_id, file_name, file_path, sha256, created_at FROM evidence WHERE tenant_id = $1 ORDER BY created_at DESC`,
    [tenantId]
  );

  const test: TestRow | null = testRes.rows[0] ?? null;
  const evidence: EvidenceRow[] = evidenceRes.rows;

  const procedureStr =
    typeof test?.procedure_steps === 'string'
      ? test.procedure_steps
      : JSON.stringify(test?.procedure_steps ?? []);

  const userContent = `Test (id: ${testId}):
- test_type: ${test?.test_type ?? 'N/A'}
- procedure_steps: ${procedureStr}
- sample_size: ${test?.sample_size ?? 'N/A'}

Evidence for tenant (${evidence.length} item(s)):
${evidence.length === 0 ? 'No evidence on file.' : evidence.map((e) => `- file: ${e.file_name ?? e.file_path ?? 'unnamed'}, SHA256: ${e.sha256}, path: ${e.file_path ?? 'N/A'}`).join('\n')}

Assess if this evidence is sufficient to conclude the test.`;

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set');
  }

  const client = new Groq({ apiKey });
  const chatCompletion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: REVIEW_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  });

  const choice = chatCompletion.choices?.[0];
  const text = (choice?.message?.content ?? '').trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch?.[0] ?? '{}';

  let parsed: ReviewResult;
  try {
    parsed = JSON.parse(jsonStr) as ReviewResult;
  } catch {
    parsed = {
      sufficient: false,
      reasoning: 'Could not parse AI response.',
      recommendations: ['Retry the review or check evidence format.'],
    };
  }

  if (typeof parsed.sufficient !== 'boolean') parsed.sufficient = false;
  if (typeof parsed.reasoning !== 'string') parsed.reasoning = String(parsed.reasoning ?? '');
  if (!Array.isArray(parsed.recommendations)) parsed.recommendations = [];

  const usage = chatCompletion.usage;
  const inputTokens = usage?.prompt_tokens ?? 0;
  const outputTokens = usage?.completion_tokens ?? 0;

  return {
    result: parsed,
    prompt: userContent,
    usage: { inputTokens, outputTokens },
  };
}
