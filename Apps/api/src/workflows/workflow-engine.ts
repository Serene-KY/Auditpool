/**
 * Workflow engine: evaluates audit lifecycle state and readiness scoring.
 */

import type { PoolClient } from 'pg';
import type { WorkflowStage, WorkflowStatus, BlockingIssue } from './workflow-types';
import { WORKFLOW_STAGES } from './workflow-types';
import { fetchWorkflowSnapshot, validateUpToStage } from './workflow-rules';

const DEDUCTION_RISKS_WITHOUT_CONTROLS = 10;
const DEDUCTION_CONTROLS_WITHOUT_TESTS = 10;
const DEDUCTION_TESTS_WITHOUT_EVIDENCE = 10;
const DEDUCTION_TESTS_WITHOUT_CONCLUSIONS = 10;

/**
 * Calculate readiness score (0–100).
 * 100 = complete audit chain.
 * Subtract: risks without controls (-10), controls without tests (-10),
 * tests without evidence (-10), tests without conclusions (-10).
 */
export function calculateReadinessScore(snapshot: {
  risksWithoutControls: { risk_id: string }[];
  controlsWithoutTests: { control_id: string }[];
  testsWithoutEvidence: { test_id: string }[];
  testsWithoutConclusions: { test_id: string }[];
}): number {
  let score = 100;
  score -= snapshot.risksWithoutControls.length * DEDUCTION_RISKS_WITHOUT_CONTROLS;
  score -= snapshot.controlsWithoutTests.length * DEDUCTION_CONTROLS_WITHOUT_TESTS;
  score -= snapshot.testsWithoutEvidence.length * DEDUCTION_TESTS_WITHOUT_EVIDENCE;
  score -= snapshot.testsWithoutConclusions.length * DEDUCTION_TESTS_WITHOUT_CONCLUSIONS;
  return Math.max(0, score);
}

/**
 * Determine the current workflow stage based on snapshot and rule validation.
 */
function determineCurrentStage(
  snapshot: Awaited<ReturnType<typeof fetchWorkflowSnapshot>>,
  allBlockingIssues: BlockingIssue[]
): WorkflowStage {
  if (!snapshot.frameworkExists || snapshot.scopeCount < 1) {
    return 'PLANNING';
  }
  if (snapshot.scopesWithoutRisks.length > 0 || snapshot.riskCount === 0) {
    return 'RISK_ASSESSMENT';
  }
  if (snapshot.risksWithoutControls.length > 0) {
    return 'CONTROL_MAPPING';
  }
  if (snapshot.controlsWithoutTests.length > 0) {
    return 'TEST_DESIGN';
  }
  if (snapshot.testCount === 0 || snapshot.testsWithoutProcedureSteps.length > 0) {
    return 'FIELDWORK';
  }
  if (snapshot.testsWithoutEvidence.length > 0) {
    return 'EVIDENCE_REVIEW';
  }
  if (snapshot.testsWithoutConclusions.length > 0) {
    return 'CONCLUSION';
  }
  return 'COMPLETE';
}

/**
 * Evaluate workflow state for a framework.
 */
export async function evaluateWorkflowState(
  db: PoolClient,
  tenantId: string,
  frameworkId: string
): Promise<WorkflowStatus> {
  const snapshot = await fetchWorkflowSnapshot(db, tenantId, frameworkId);
  const currentStage = determineCurrentStage(snapshot, []);

  const { issues: blockingIssues } = validateUpToStage(currentStage, snapshot);
  const readinessScore = calculateReadinessScore(snapshot);

  const stageRequirementsMet = {} as Record<WorkflowStage, boolean>;
  for (const stage of WORKFLOW_STAGES) {
    const { passed } = validateUpToStage(stage, snapshot);
    stageRequirementsMet[stage] = passed;
  }

  const canAdvance =
    currentStage !== 'COMPLETE' && blockingIssues.length === 0;

  return {
    current_stage: currentStage,
    readiness_score: readinessScore,
    blocking_issues: blockingIssues,
    can_advance: !!canAdvance,
    stage_requirements_met: stageRequirementsMet,
  };
}
