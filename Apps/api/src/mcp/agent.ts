import {
  GoogleGenerativeAI,
  SchemaType,
  FunctionCallingMode,
  type FunctionCall,
  type Part,
} from '@google/generative-ai';
import type { PoolClient } from 'pg';
import { TOOL_DEFINITIONS, runTool } from './server';
import type { ToolName } from './tools';

const MODEL = 'models/gemini-2.5-flash';

function toGeminiDeclarations() {
  const declarations = TOOL_DEFINITIONS.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: {
      type: SchemaType.OBJECT as const,
      properties: Object.fromEntries(
        Object.entries(t.parameters.properties).map(([k, v]) => [
          k,
          { type: SchemaType.STRING as const, description: v.description },
        ])
      ) as Record<string, { type: typeof SchemaType.STRING; description: string }>,
      required: t.parameters.required,
    },
  }));
  return [{ functionDeclarations: declarations }];
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
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: `You are an ISA (Information Security Auditor) reviewing audit evidence.
Use the provided tools to fetch the test, its control, risk, audit scope, framework, and evidence.
Assess if the evidence is sufficient to conclude the test. Always call the tools to gather context - do not guess.
Respond with valid JSON only: {"sufficient": boolean, "reasoning": string, "recommendations": string[]}`,
    tools: toGeminiDeclarations(),
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
  });

  const contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: { name: string; args: object }; functionResponse?: { name: string; response: object } }> }> = [
    {
      role: 'user',
      parts: [
        {
          text: `Review the evidence for test id ${testId}. Use the tools to fetch the test, its control, risks, audit scope, framework, and all evidence. Then assess sufficiency and respond with JSON: {"sufficient": boolean, "reasoning": string, "recommendations": string[]}`,
        },
      ],
    },
  ];

  let maxTurns = 10;
  while (maxTurns-- > 0) {
    const result = await model.generateContent({
      contents: contents as never,
    });
    const response = result.response;
    const candidates = response.candidates;
    if (!candidates?.length) {
      const text = response.text?.() ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]) as ReviewResult;
        } catch {
          return {
            sufficient: false,
            reasoning: 'Could not parse AI response.',
            recommendations: ['Retry the review.'],
          };
        }
      }
      throw new Error('No response from model');
    }

    const parts = candidates[0].content?.parts ?? [];
    const functionCalls: FunctionCall[] = parts
      .filter((p: Part): p is Part & { functionCall: FunctionCall } => 'functionCall' in p && !!p.functionCall)
      .map((p) => p.functionCall);

    if (functionCalls.length === 0) {
      const textPart = parts.find((p: { text?: string }) => p.text);
      const text = (textPart?.text ?? response.text?.() ?? '').trim();
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

    for (const fc of functionCalls) {
      const args = { ...(fc.args as Record<string, unknown>), tenantId };
      let out: unknown;
      try {
        out = await runTool(db, fc.name as ToolName, args);
      } catch (err) {
        out = { error: err instanceof Error ? err.message : 'Tool failed' };
      }
      contents.push({
        role: 'model',
        parts: [{ functionCall: fc }],
      });
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: fc.name, response: { result: out } } }],
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

export async function preparerAgent(
  db: PoolClient,
  tenantId: string
): Promise<PreparerSuggestion> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    systemInstruction: `You are an audit preparer. Use the provided tools to explore the tenant's audit structure:
frameworks -> audit_scopes -> risks -> controls -> tests -> evidence.
Identify gaps: risks that have no controls, or controls that have no tests.
Suggest specific controls to add. Respond with JSON: {"summary": string, "suggestedControls": [{"riskId": string, "controlCode": string, "description": string}]}`,
    tools: toGeminiDeclarations(),
    toolConfig: {
      functionCallingConfig: { mode: FunctionCallingMode.AUTO },
    },
  });

  const contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: { name: string; args: object }; functionResponse?: { name: string; response: object } }> }> = [
    {
      role: 'user',
      parts: [
        {
          text: `Analyze the audit structure for this tenant. Use the tools to fetch frameworks, audit scopes, risks, controls, tests, and evidence. Identify risks without controls and controls without tests. Suggest missing controls. Respond with JSON: {"summary": string, "suggestedControls": [{"riskId": string, "controlCode": string, "description": string}]}`,
        },
      ],
    },
  ];

  let maxTurns = 12;
  while (maxTurns-- > 0) {
    const result = await model.generateContent({
      contents: contents as never,
    });
    const response = result.response;
    const candidates = response.candidates;
    if (!candidates?.length) {
      const text = response.text?.() ?? '';
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

    const parts = candidates[0].content?.parts ?? [];
    const functionCalls: FunctionCall[] = parts
      .filter((p: Part): p is Part & { functionCall: FunctionCall } => 'functionCall' in p && !!p.functionCall)
      .map((p) => p.functionCall);

    if (functionCalls.length === 0) {
      const text = response.text?.() ?? '';
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

    for (const fc of functionCalls) {
      const args = { ...(fc.args as Record<string, unknown>), tenantId };
      let out: unknown;
      try {
        out = await runTool(db, fc.name as ToolName, args);
      } catch (err) {
        out = { error: err instanceof Error ? err.message : 'Tool failed' };
      }
      contents.push({
        role: 'model',
        parts: [{ functionCall: fc }],
      });
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: fc.name, response: { result: out } } }],
      });
    }
  }

  return { summary: 'Max turns exceeded.', suggestedControls: [] };
}
