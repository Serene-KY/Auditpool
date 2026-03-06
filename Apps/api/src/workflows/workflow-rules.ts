/**
 * Workflow validation rules per ISA audit lifecycle.
 * Schema: frameworks, audit_scopes (id, tenant_id, name, framework_id),
 * risks (id, tenant_id, scope_id, title, assertion, rmm_level),
 * controls (id, tenant_id, risk_id, control_code, frequency, control_type),
 * tests (id, tenant_id, control_id, test_type, procedure_steps, sample_size).
 */

import type { PoolClient } from 'pg';
import type { WorkflowStage } from './workflow-types';
import { WORKFLOW_STAGES } from './workflow-types';
import type { BlockingIssue } from './workflow-types';

export interface RuleValidationResult {
  passed: boolean;
  issues: BlockingIssue[];
}

export interface WorkflowSnapshot {
  frameworkExists: boolean;
  scopeCount: number;
  scopeIds: string[];
  scopesWithoutRisks: string[];
  riskCount: number;
  risksWithoutControls: { risk_id: string }[];
  controlCount: number;
  controlsWithoutTests: { control_id: string }[];
  testCount: number;
  testsWithoutProcedureSteps: { test_id: string; control_id: string }[];
  testsWithoutEvidence: { test_id: string; control_id: string }[];
  testsWithoutConclusions: { test_id: string; control_id: string }[];
}

/** Fetch audit chain data for a framework (respects RLS via tenant context). */
export async function fetchWorkflowSnapshot(
  db: PoolClient,
  tenantId: string,
  frameworkId: string
): Promise<WorkflowSnapshot> {
  const [fw, scopes, risksNoCtrl, ctrlNoTest, testsNoProc, testsNoEv, testsNoCon] = await Promise.all([
    db.query(
      'SELECT id FROM frameworks WHERE tenant_id = $1 AND id = $2',
      [tenantId, frameworkId]
    ),
    db.query(
      'SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2',
      [tenantId, frameworkId]
    ),
    db.query(
      `SELECT r.id AS risk_id FROM risks r
       WHERE r.tenant_id = $1 AND r.scope_id IN (
         SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2
       )
       AND NOT EXISTS (SELECT 1 FROM controls c WHERE c.risk_id = r.id)`,
      [tenantId, frameworkId]
    ),
    db.query(
      `SELECT c.id AS control_id FROM controls c
       INNER JOIN risks r ON r.id = c.risk_id
       WHERE c.tenant_id = $1 AND r.scope_id IN (
         SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2
       )
       AND NOT EXISTS (SELECT 1 FROM tests t WHERE t.control_id = c.id)`,
      [tenantId, frameworkId]
    ),
    db.query(
      `SELECT t.id AS test_id, t.control_id FROM tests t
       INNER JOIN controls c ON c.id = t.control_id
       INNER JOIN risks r ON r.id = c.risk_id
       WHERE t.tenant_id = $1 AND r.scope_id IN (
         SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2
       )
       AND (
         t.procedure_steps IS NULL
         OR t.procedure_steps::text IN ('[]','null','""')
         OR jsonb_array_length(COALESCE(t.procedure_steps::jsonb, '[]'::jsonb)) = 0
       )`,
      [tenantId, frameworkId]
    ).catch(() => ({ rows: [] })),
    db.query(
      `SELECT t.id AS test_id, t.control_id FROM tests t
       INNER JOIN controls c ON c.id = t.control_id
       INNER JOIN risks r ON r.id = c.risk_id
       WHERE t.tenant_id = $1 AND r.scope_id IN (
         SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2
       )
       AND NOT EXISTS (SELECT 1 FROM evidence e WHERE e.test_id = t.id)`,
      [tenantId, frameworkId]
    ),
    db.query(
      `SELECT t.id AS test_id, t.control_id FROM tests t
       INNER JOIN controls c ON c.id = t.control_id
       INNER JOIN risks r ON r.id = c.risk_id
       WHERE t.tenant_id = $1 AND r.scope_id IN (
         SELECT id FROM audit_scopes WHERE tenant_id = $1 AND framework_id = $2
       )
       AND NOT EXISTS (SELECT 1 FROM conclusions co WHERE co.test_id = t.id)`,
      [tenantId, frameworkId]
    ),
  ]);

  const scopeIds = scopes.rows.map((r: { id: string }) => r.id);

  const scopesWithoutRisks =
    scopeIds.length > 0
      ? (
          await db.query(
            `SELECT s.id FROM audit_scopes s
             WHERE s.tenant_id = $1 AND s.framework_id = $2
             AND NOT EXISTS (SELECT 1 FROM risks r WHERE r.scope_id = s.id)`,
            [tenantId, frameworkId]
          )
        ).rows.map((r: { id: string }) => r.id)
      : [];

  const riskCountResult = scopeIds.length
    ? await db.query(
        `SELECT COUNT(*)::int AS c FROM risks WHERE tenant_id = $1 AND scope_id = ANY($2::uuid[])`,
        [tenantId, scopeIds]
      )
    : { rows: [{ c: 0 }] };
  const controlCountResult = scopeIds.length
    ? await db.query(
        `SELECT COUNT(*)::int AS c FROM controls c
         INNER JOIN risks r ON r.id = c.risk_id
         WHERE c.tenant_id = $1 AND r.scope_id = ANY($2::uuid[])`,
        [tenantId, scopeIds]
      )
    : { rows: [{ c: 0 }] };
  const testCountResult = scopeIds.length
    ? await db.query(
        `SELECT COUNT(*)::int AS c FROM tests t
         INNER JOIN controls c ON c.id = t.control_id
         INNER JOIN risks r ON r.id = c.risk_id
         WHERE t.tenant_id = $1 AND r.scope_id = ANY($2::uuid[])`,
        [tenantId, scopeIds]
      )
    : { rows: [{ c: 0 }] };

  return {
    frameworkExists: fw.rows.length > 0,
    scopeCount: scopes.rows.length,
    scopeIds,
    scopesWithoutRisks,
    riskCount: riskCountResult.rows[0]?.c ?? 0,
    risksWithoutControls: risksNoCtrl.rows as { risk_id: string }[],
    controlCount: controlCountResult.rows[0]?.c ?? 0,
    controlsWithoutTests: ctrlNoTest.rows as { control_id: string }[],
    testCount: testCountResult.rows[0]?.c ?? 0,
    testsWithoutProcedureSteps: (testsNoProc.rows ?? []) as { test_id: string; control_id: string }[],
    testsWithoutEvidence: testsNoEv.rows as { test_id: string; control_id: string }[],
    testsWithoutConclusions: testsNoCon.rows as { test_id: string; control_id: string }[],
  };
}

/** Validate whether a given stage's requirements are met. */
export function validateStage(
  stage: WorkflowStage,
  snapshot: WorkflowSnapshot
): RuleValidationResult {
  const issues: BlockingIssue[] = [];

  switch (stage) {
    case 'PLANNING': {
      if (!snapshot.frameworkExists) {
        issues.push({ type: 'missing_framework', message: 'Framework must exist' });
      }
      if (snapshot.scopeCount < 1) {
        issues.push({ type: 'missing_scope', message: 'At least one audit scope must exist' });
      }
      break;
    }
    case 'RISK_ASSESSMENT': {
      const planningOk = snapshot.frameworkExists && snapshot.scopeCount >= 1;
      if (!planningOk) {
        issues.push({ type: 'missing_scope', message: 'Complete planning first (framework + scope)' });
      }
      for (const scopeId of snapshot.scopesWithoutRisks) {
        issues.push({
          type: 'missing_risk',
          scope_id: scopeId,
          message: 'Each scope must contain at least one risk',
        });
      }
      break;
    }
    case 'CONTROL_MAPPING': {
      if (snapshot.risksWithoutControls.length > 0) {
        for (const r of snapshot.risksWithoutControls) {
          issues.push({ type: 'missing_control', risk_id: r.risk_id });
        }
      }
      break;
    }
    case 'TEST_DESIGN': {
      if (snapshot.controlsWithoutTests.length > 0) {
        for (const c of snapshot.controlsWithoutTests) {
          issues.push({ type: 'missing_test', control_id: c.control_id });
        }
      }
      break;
    }
    case 'FIELDWORK': {
      if (snapshot.testCount === 0) {
        issues.push({ type: 'missing_test', message: 'Tests must exist' });
      }
      if (snapshot.testsWithoutProcedureSteps.length > 0) {
        for (const t of snapshot.testsWithoutProcedureSteps) {
          issues.push({
            type: 'missing_procedure_steps',
            test_id: t.test_id,
            control_id: t.control_id,
            message: 'Test must have defined procedure_steps',
          });
        }
      }
      break;
    }
    case 'EVIDENCE_REVIEW': {
      if (snapshot.testsWithoutEvidence.length > 0) {
        for (const t of snapshot.testsWithoutEvidence) {
          issues.push({
            type: 'missing_evidence',
            test_id: t.test_id,
            control_id: t.control_id,
          });
        }
      }
      break;
    }
    case 'CONCLUSION': {
      if (snapshot.testsWithoutConclusions.length > 0) {
        for (const t of snapshot.testsWithoutConclusions) {
          issues.push({
            type: 'missing_conclusion',
            test_id: t.test_id,
            control_id: t.control_id,
          });
        }
      }
      break;
    }
    case 'COMPLETE': {
      if (snapshot.testsWithoutConclusions.length > 0) {
        for (const t of snapshot.testsWithoutConclusions) {
          issues.push({
            type: 'missing_conclusion',
            test_id: t.test_id,
            control_id: t.control_id,
          });
        }
      }
      break;
    }
  }

  return {
    passed: issues.length === 0,
    issues,
  };
}

/** Validate all requirements up to and including the given stage. */
export function validateUpToStage(
  targetStage: WorkflowStage,
  snapshot: WorkflowSnapshot
): { passed: boolean; issues: BlockingIssue[] } {
  const allIssues: BlockingIssue[] = [];
  const stageIndex = WORKFLOW_STAGES.indexOf(targetStage);

  for (let i = 0; i <= stageIndex; i++) {
    const stage = WORKFLOW_STAGES[i];
    const result = validateStage(stage, snapshot);
    allIssues.push(...result.issues);
  }

  return {
    passed: allIssues.length === 0,
    issues: allIssues,
  };
}
