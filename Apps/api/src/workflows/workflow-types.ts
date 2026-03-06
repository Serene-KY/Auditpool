/**
 * Workflow types for the ISA audit lifecycle.
 * Lifecycle order: Framework -> Scope -> Risk -> Control -> Test -> Evidence -> Conclusion
 */

export const WORKFLOW_STAGES = [
  'PLANNING',
  'RISK_ASSESSMENT',
  'CONTROL_MAPPING',
  'TEST_DESIGN',
  'FIELDWORK',
  'EVIDENCE_REVIEW',
  'CONCLUSION',
  'COMPLETE',
] as const;

export type WorkflowStage = (typeof WORKFLOW_STAGES)[number];

export const STAGE_ORDER: Record<WorkflowStage, number> = {
  PLANNING: 0,
  RISK_ASSESSMENT: 1,
  CONTROL_MAPPING: 2,
  TEST_DESIGN: 3,
  FIELDWORK: 4,
  EVIDENCE_REVIEW: 5,
  CONCLUSION: 6,
  COMPLETE: 7,
};

export type BlockingIssueType =
  | 'missing_framework'
  | 'missing_scope'
  | 'missing_risk'
  | 'missing_control'
  | 'missing_test'
  | 'missing_procedure_steps'
  | 'missing_evidence'
  | 'missing_conclusion'
  | 'unresolved_review';

export interface BlockingIssue {
  type: BlockingIssueType;
  scope_id?: string;
  risk_id?: string;
  control_id?: string;
  test_id?: string;
  message?: string;
}

export interface WorkflowStatus {
  current_stage: WorkflowStage;
  readiness_score: number;
  blocking_issues: BlockingIssue[];
  can_advance: boolean;
  stage_requirements_met: Record<WorkflowStage, boolean>;
}

export interface WorkflowEventPayload {
  previous_stage: WorkflowStage;
  new_stage: WorkflowStage;
  triggered_by?: string;
  timestamp: string;
}
