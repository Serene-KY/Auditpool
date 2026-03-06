import { describe, it, expect } from 'vitest';
import { calculateReadinessScore } from './workflow-engine';
import { validateStage, validateUpToStage } from './workflow-rules';
import type { WorkflowSnapshot } from './workflow-rules';

function emptySnapshot(): WorkflowSnapshot {
  return {
    frameworkExists: false,
    scopeCount: 0,
    scopeIds: [],
    scopesWithoutRisks: [],
    riskCount: 0,
    risksWithoutControls: [],
    controlCount: 0,
    controlsWithoutTests: [],
    testCount: 0,
    testsWithoutProcedureSteps: [],
    testsWithoutEvidence: [],
    testsWithoutConclusions: [],
  };
}

describe('calculateReadinessScore', () => {
  it('returns 100 for complete chain', () => {
    const score = calculateReadinessScore({
      risksWithoutControls: [],
      controlsWithoutTests: [],
      testsWithoutEvidence: [],
      testsWithoutConclusions: [],
    });
    expect(score).toBe(100);
  });

  it('subtracts 10 per risk without controls', () => {
    const score = calculateReadinessScore({
      risksWithoutControls: [{ risk_id: 'a' }, { risk_id: 'b' }],
      controlsWithoutTests: [],
      testsWithoutEvidence: [],
      testsWithoutConclusions: [],
    });
    expect(score).toBe(80);
  });

  it('subtracts 10 per control without tests', () => {
    const score = calculateReadinessScore({
      risksWithoutControls: [],
      controlsWithoutTests: [{ control_id: 'c1' }],
      testsWithoutEvidence: [],
      testsWithoutConclusions: [],
    });
    expect(score).toBe(90);
  });

  it('subtracts 10 per test without evidence', () => {
    const score = calculateReadinessScore({
      risksWithoutControls: [],
      controlsWithoutTests: [],
      testsWithoutEvidence: [{ test_id: 't1' }],
      testsWithoutConclusions: [],
    });
    expect(score).toBe(90);
  });

  it('subtracts 10 per test without conclusion', () => {
    const score = calculateReadinessScore({
      risksWithoutControls: [],
      controlsWithoutTests: [],
      testsWithoutEvidence: [],
      testsWithoutConclusions: [{ test_id: 't1' }],
    });
    expect(score).toBe(90);
  });

  it('combines deductions and never goes below 0', () => {
    const score = calculateReadinessScore({
      risksWithoutControls: Array(15).fill({ risk_id: 'x' }),
      controlsWithoutTests: [],
      testsWithoutEvidence: [],
      testsWithoutConclusions: [],
    });
    expect(score).toBe(0);
  });
});

describe('validateStage', () => {
  it('PLANNING: fails when framework missing', () => {
    const snapshot = emptySnapshot();
    snapshot.frameworkExists = false;
    const result = validateStage('PLANNING', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.type === 'missing_framework')).toBe(true);
  });

  it('PLANNING: fails when no scopes', () => {
    const snapshot = emptySnapshot();
    snapshot.frameworkExists = true;
    snapshot.scopeCount = 0;
    const result = validateStage('PLANNING', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.type === 'missing_scope')).toBe(true);
  });

  it('PLANNING: passes with framework and at least one scope', () => {
    const snapshot = emptySnapshot();
    snapshot.frameworkExists = true;
    snapshot.scopeCount = 1;
    snapshot.scopeIds = ['s1'];
    snapshot.scopesWithoutRisks = [];
    const result = validateStage('PLANNING', snapshot);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('RISK_ASSESSMENT: fails when scopes have no risks', () => {
    const snapshot = emptySnapshot();
    snapshot.frameworkExists = true;
    snapshot.scopeCount = 1;
    snapshot.scopeIds = ['s1'];
    snapshot.scopesWithoutRisks = ['s1'];
    const result = validateStage('RISK_ASSESSMENT', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues.some((i) => i.type === 'missing_risk')).toBe(true);
  });

  it('CONTROL_MAPPING: fails when risks have no controls', () => {
    const snapshot = emptySnapshot();
    snapshot.risksWithoutControls = [{ risk_id: 'r1' }];
    const result = validateStage('CONTROL_MAPPING', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].type).toBe('missing_control');
    expect(result.issues[0].risk_id).toBe('r1');
  });

  it('TEST_DESIGN: fails when controls have no tests', () => {
    const snapshot = emptySnapshot();
    snapshot.controlsWithoutTests = [{ control_id: 'c1' }];
    const result = validateStage('TEST_DESIGN', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].type).toBe('missing_test');
    expect(result.issues[0].control_id).toBe('c1');
  });

  it('EVIDENCE_REVIEW: fails when tests have no evidence', () => {
    const snapshot = emptySnapshot();
    snapshot.testsWithoutEvidence = [{ test_id: 't1', control_id: 'c1' }];
    const result = validateStage('EVIDENCE_REVIEW', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].type).toBe('missing_evidence');
  });

  it('CONCLUSION: fails when tests have no conclusions', () => {
    const snapshot = emptySnapshot();
    snapshot.testsWithoutConclusions = [{ test_id: 't1', control_id: 'c1' }];
    const result = validateStage('CONCLUSION', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].type).toBe('missing_conclusion');
  });
});

describe('validateUpToStage', () => {
  it('accumulates issues from all stages up to target', () => {
    const snapshot = emptySnapshot();
    snapshot.frameworkExists = true;
    snapshot.scopeCount = 1;
    snapshot.scopeIds = ['s1'];
    snapshot.scopesWithoutRisks = ['s1'];
    snapshot.risksWithoutControls = [{ risk_id: 'r1' }];
    const result = validateUpToStage('CONTROL_MAPPING', snapshot);
    expect(result.passed).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(1);
  });

  it('passes when all requirements for stage are met', () => {
    const snapshot = emptySnapshot();
    snapshot.frameworkExists = true;
    snapshot.scopeCount = 2;
    snapshot.scopeIds = ['s1', 's2'];
    snapshot.scopesWithoutRisks = [];
    snapshot.riskCount = 2;
    snapshot.risksWithoutControls = [];
    snapshot.controlsWithoutTests = [];
    snapshot.testCount = 1;
    snapshot.testsWithoutProcedureSteps = [];
    snapshot.testsWithoutEvidence = [];
    snapshot.testsWithoutConclusions = [];
    const result = validateUpToStage('COMPLETE', snapshot);
    expect(result.passed).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
