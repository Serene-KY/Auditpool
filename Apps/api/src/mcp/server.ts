import type { PoolClient } from 'pg';
import {
  executeTool,
  TOOL_NAMES,
  type ToolName,
} from './tools';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, { type: string; description: string; maxLength?: number }>;
    required: string[];
  };
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'get_frameworks',
    description: 'Returns all frameworks for a tenant',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'get_audit_scopes',
    description: 'Returns audit scopes for a framework',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
        frameworkId: { type: 'string', description: 'Framework UUID' },
      },
      required: ['tenantId', 'frameworkId'],
    },
  },
  {
    name: 'get_risks',
    description: 'Returns risks for an audit scope',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
        scopeId: { type: 'string', description: 'Audit scope UUID' },
      },
      required: ['tenantId', 'scopeId'],
    },
  },
  {
    name: 'get_controls',
    description: 'Returns controls for a risk',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
        riskId: { type: 'string', description: 'Risk UUID' },
      },
      required: ['tenantId', 'riskId'],
    },
  },
  {
    name: 'get_tests',
    description: 'Returns tests for a control',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
        controlId: { type: 'string', description: 'Control UUID' },
      },
      required: ['tenantId', 'controlId'],
    },
  },
  {
    name: 'get_evidence',
    description: 'Returns all evidence for a tenant',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
      },
      required: ['tenantId'],
    },
  },
  {
    name: 'create_framework',
    description: 'Creates a new framework',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
        name: { type: 'string', description: 'Framework name', maxLength: 500 },
        description: { type: 'string', description: 'Framework description', maxLength: 2000 },
      },
      required: ['tenantId', 'name'],
    },
  },
  {
    name: 'create_risk',
    description: 'Creates a new risk in an audit scope',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
        scopeId: { type: 'string', description: 'Audit scope UUID' },
        title: { type: 'string', description: 'Risk title', maxLength: 500 },
        assertion: { type: 'string', description: 'Risk assertion', maxLength: 2000 },
        rmmLevel: { type: 'string', description: 'Risk management maturity level', maxLength: 100 },
      },
      required: ['tenantId', 'scopeId', 'title'],
    },
  },
  {
    name: 'create_control',
    description: 'Creates a new control for a risk',
    parameters: {
      type: 'object',
      properties: {
        tenantId: { type: 'string', description: 'Tenant UUID' },
        riskId: { type: 'string', description: 'Risk UUID' },
        controlCode: { type: 'string', description: 'Control code', maxLength: 100 },
        frequency: { type: 'string', description: 'Control frequency' },
        controlType: { type: 'string', description: 'Control type' },
      },
      required: ['tenantId', 'riskId', 'controlCode'],
    },
  },
];

export function listTools(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

export async function runTool(
  db: PoolClient,
  name: ToolName,
  params: Record<string, unknown>
): Promise<unknown> {
  return executeTool(db, name, params);
}
