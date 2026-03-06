import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat/completions';
import type { PoolClient } from 'pg';
import { TOOL_DEFINITIONS, runTool } from './server';
import type { ToolName } from './tools';

const MODEL = 'llama-3.3-70b-versatile';

function toGroqTools() {
  return TOOL_DEFINITIONS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object' as const,
        properties: Object.fromEntries(
          Object.entries(t.parameters.properties).map(([k, v]) => [
            k,
            { type: 'string' as const, description: v.description },
          ])
        ),
        required: t.parameters.required,
      },
    },
  }));
}

export interface ReviewResult {
  sufficient: boolean;
  reasoning: string;
  recommendations: string[];
}

export async function reviewerAgent(
  db: PoolClient,
  tenantId: string,
  testId: string
): Promise<ReviewResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const client = new Groq({ apiKey });
  const tools = toGroqTools();

  const systemContent = `You are an ISA (Information Security Auditor) reviewing audit evidence.
Use the provided tools to fetch the test, its control, risk, audit scope, framework, and evidence.
Assess if the evidence is sufficient to conclude the test. Always call the tools to gather context - do not guess.
Respond in English only. Respond with valid JSON only: {"sufficient": boolean, "reasoning": string, "recommendations": string[]}`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    {
      role: 'user',
      content: `Review the evidence for test id ${testId}. Use the tools to fetch the test, its control, risks, audit scope, framework, and all evidence. Then assess sufficiency and respond with JSON: {"sufficient": boolean, "reasoning": string, "recommendations": string[]}`,
    },
  ];

  let maxTurns = 10;
  while (maxTurns-- > 0) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
    });

    const choice = completion.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      const text = choice?.message?.content ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as ReviewResult;
        } catch {
          return { sufficient: false, reasoning: 'Could not parse AI response.', recommendations: ['Retry the review.'] };
        }
      }
      throw new Error('No response from model');
    }

    const toolCalls = msg.tool_calls;
    if (!toolCalls?.length) {
      const text = (msg.content ?? '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as ReviewResult;
          if (typeof parsed.sufficient === 'boolean') {
            return {
              sufficient: parsed.sufficient,
              reasoning: String(parsed.reasoning ?? ''),
              recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            };
          }
        } catch {
          /* fallthrough */
        }
      }
      return {
        sufficient: false,
        reasoning: text || 'No assessment returned.',
        recommendations: ['Retry the review.'],
      };
    }

    messages.push({
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' },
      })),
    });

    for (const tc of toolCalls) {
      const name = tc.function?.name ?? '';
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments ?? '{}') as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const fullArgs = { ...args, tenantId };
      let out: unknown;
      try {
        out = await runTool(db, name as ToolName, fullArgs);
      } catch (err) {
        out = { error: err instanceof Error ? err.message : 'Tool failed' };
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({ result: out }),
      });
    }
  }

  return {
    sufficient: false,
    reasoning: 'Max tool-call turns exceeded.',
    recommendations: ['Retry the review.'],
  };
}

export interface PreparerSuggestion {
  summary: string;
  suggestedControls: Array<{ riskId: string; controlCode: string; description?: string }>;
}

export async function preparerAgent(db: PoolClient, tenantId: string): Promise<PreparerSuggestion> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY is not set');

  const client = new Groq({ apiKey });
  const tools = toGroqTools();

  const systemContent = `You are an audit preparer. Use the provided tools to explore the tenant's audit structure:
frameworks -> audit_scopes -> risks -> controls -> tests -> evidence.
Identify gaps: risks that have no controls, or controls that have no tests.
Suggest specific controls to add. Respond in English only. Respond with JSON: {"summary": string, "suggestedControls": [{"riskId": string, "controlCode": string, "description": string}]}`;

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemContent },
    {
      role: 'user',
      content: `Analyze the audit structure for this tenant. Use the tools to fetch frameworks, audit scopes, risks, controls, tests, and evidence. Identify risks without controls and controls without tests. Suggest missing controls. Respond with JSON: {"summary": string, "suggestedControls": [{"riskId": string, "controlCode": string, "description": string}]}`,
    },
  ];

  let maxTurns = 12;
  while (maxTurns-- > 0) {
    const completion = await client.chat.completions.create({
      model: MODEL,
      messages,
      tools,
      tool_choice: 'auto',
    });

    const choice = completion.choices?.[0];
    const msg = choice?.message;
    if (!msg) {
      const text = choice?.message?.content ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as PreparerSuggestion;
        } catch {
          return { summary: text || 'No analysis.', suggestedControls: [] };
        }
      }
      return { summary: 'No response from model.', suggestedControls: [] };
    }

    const toolCalls = msg.tool_calls;
    if (!toolCalls?.length) {
      const text = (msg.content ?? '').trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]) as PreparerSuggestion;
          return {
            summary: String(parsed.summary ?? ''),
            suggestedControls: Array.isArray(parsed.suggestedControls) ? parsed.suggestedControls : [],
          };
        } catch {
          return { summary: text, suggestedControls: [] };
        }
      }
      return { summary: text || 'No analysis.', suggestedControls: [] };
    }

    messages.push({
      role: 'assistant',
      content: msg.content ?? null,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: { name: tc.function?.name ?? '', arguments: tc.function?.arguments ?? '{}' },
      })),
    });

    for (const tc of toolCalls) {
      const name = tc.function?.name ?? '';
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(tc.function?.arguments ?? '{}') as Record<string, unknown>;
      } catch {
        /* ignore */
      }
      const fullArgs = { ...args, tenantId };
      let out: unknown;
      try {
        out = await runTool(db, name as ToolName, fullArgs);
      } catch (err) {
        out = { error: err instanceof Error ? err.message : 'Tool failed' };
      }

      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify({ result: out }),
      });
    }
  }

  return { summary: 'Max turns exceeded.', suggestedControls: [] };
}
