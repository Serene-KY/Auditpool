'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  fetchDashboardStats,
  fetchTenants,
  fetchFrameworks,
  fetchWorkflowStatus,
  type DashboardStats,
  type Tenant,
  type WorkflowStatus,
} from '@/lib/api';

const WORKFLOW_STAGES = [
  'Framework',
  'Scope',
  'Risk Assessment',
  'Control Mapping',
  'Test Design',
  'Fieldwork',
  'Evidence Review',
  'Conclusion',
];

const STAGE_TO_CURRENT_INDEX: Record<string, number> = {
  PLANNING: 0,
  RISK_ASSESSMENT: 2,
  CONTROL_MAPPING: 3,
  TEST_DESIGN: 4,
  FIELDWORK: 5,
  EVIDENCE_REVIEW: 6,
  CONCLUSION: 7,
  COMPLETE: 8,
};

function getCurrentStepIndex(stage: string): number {
  return STAGE_TO_CURRENT_INDEX[stage] ?? 0;
}

const links = [
  { href: '/frameworks', label: 'Frameworks' },
  { href: '/audit-scopes', label: 'Audit Scopes' },
  { href: '/risks', label: 'Risks' },
  { href: '/controls', label: 'Controls' },
  { href: '/tests', label: 'Tests' },
  { href: '/evidence', label: 'Evidence' },
  { href: '/conclusions', label: 'Conclusions' },
];

const statCards: Array<{
  key: keyof DashboardStats;
  label: string;
  icon: React.ReactNode;
  href?: string;
}> = [
  { key: 'frameworkCount', label: 'Frameworks', icon: <FrameworkIcon />, href: '/frameworks' },
  { key: 'auditScopeCount', label: 'Audit Scopes', icon: <ScopeIcon />, href: '/audit-scopes' },
  { key: 'riskCount', label: 'Risks', icon: <RiskIcon />, href: '/risks' },
  { key: 'controlCount', label: 'Controls', icon: <ControlIcon />, href: '/controls' },
  { key: 'testCount', label: 'Tests', icon: <TestIcon />, href: '/tests' },
  { key: 'evidenceCount', label: 'Evidence', icon: <EvidenceIcon />, href: '/evidence' },
  { key: 'conclusionCount', label: 'Conclusions', icon: <ConclusionIcon />, href: '/conclusions' },
];

function FrameworkIcon() {
  return (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function ScopeIcon() {
  return (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function RiskIcon() {
  return (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function ControlIcon() {
  return (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  );
}

function TestIcon() {
  return (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function EvidenceIcon() {
  return (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ConclusionIcon() {
  return (
    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
      <div
        className="h-full bg-slate-700 rounded-full transition-all duration-500 ease-out"
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export default function DashboardPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTenants()
      .then((list) => {
        setTenants(list);
        if (list.length > 0 && !selectedTenantId) {
          setSelectedTenantId(list[0].id);
        }
      })
      .catch(() => setTenants([]));
  }, []);

  const load = useCallback(async () => {
    if (!selectedTenantId) return;
    setError(null);
    try {
      const data = await fetchDashboardStats(selectedTenantId);
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [selectedTenantId]);

  const loadWorkflow = useCallback(async () => {
    if (!selectedTenantId) return;
    setWorkflowLoading(true);
    try {
      const frameworks = await fetchFrameworks(selectedTenantId);
      if (frameworks.length > 0) {
        const status = await fetchWorkflowStatus(selectedTenantId, frameworks[0].id);
        setWorkflowStatus(status);
      } else {
        setWorkflowStatus(null);
      }
    } catch {
      setWorkflowStatus(null);
    } finally {
      setWorkflowLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (!selectedTenantId) return;
    setLoading(true);
    load();
  }, [selectedTenantId, load]);

  useEffect(() => {
    if (!selectedTenantId) return;
    loadWorkflow();
  }, [selectedTenantId, loadWorkflow]);

  useEffect(() => {
    if (!selectedTenantId) return;
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [selectedTenantId, load]);

  const totalChain = (stats?.riskCount ?? 0) + (stats?.controlCount ?? 0) + (stats?.testCount ?? 0);
  const totalGaps = (stats?.risksWithoutControls ?? 0) + (stats?.controlsWithoutTests ?? 0) + (stats?.testsWithoutEvidence ?? 0);
  const progress = totalChain === 0 ? 100 : Math.round(100 * (1 - totalGaps / totalChain));
  const currentStepIndex = workflowStatus ? getCurrentStepIndex(workflowStatus.current_stage) : 0;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Dashboard</h1>

      <div className="mb-6">
        <label htmlFor="tenant-select" className="block text-sm font-medium text-slate-700 mb-2">
          Tenant
        </label>
        <select
          id="tenant-select"
          value={selectedTenantId}
          onChange={(e) => setSelectedTenantId(e.target.value)}
          className="w-full max-w-xs px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:ring-2 focus:ring-slate-500 focus:border-slate-500"
        >
          <option value="">Select Tenant</option>
          {tenants.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {loading && !stats && selectedTenantId && (
        <p className="text-slate-500">Loading statistics…</p>
      )}
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {selectedTenantId && stats && (
        <>
          {/* ISA Workflow Roadmap */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow border border-slate-200">
            <h2 className="text-lg font-medium text-slate-800 mb-4">ISA Audit Workflow</h2>

            {workflowLoading ? (
              <p className="text-slate-500 text-sm">Loading workflow status...</p>
            ) : workflowStatus ? (
              <>
                <div className="mb-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">Readiness</span>
                    <span className="font-medium text-slate-800">{workflowStatus.readiness_score}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, workflowStatus.readiness_score)}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-4">
                  {WORKFLOW_STAGES.map((label, i) => {
                    const isComplete = i < currentStepIndex || workflowStatus.current_stage === 'COMPLETE';
                    const isCurrent = i === currentStepIndex && workflowStatus.current_stage !== 'COMPLETE';
                    return (
                      <span
                        key={label}
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                          isComplete
                            ? 'bg-emerald-100 text-emerald-800'
                            : isCurrent
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>

                {workflowStatus.blocking_issues.length > 0 && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm font-medium text-red-800 mb-2">Blocking issues</p>
                    <ul className="space-y-1 text-sm text-red-700 list-disc list-inside">
                      {workflowStatus.blocking_issues.map((issue, i) => (
                        <li key={i}>
                          {issue.message ?? issue.type}
                          {issue.control_id && ` (control: ${issue.control_id.slice(0, 8)}...)`}
                          {issue.test_id && ` (test: ${issue.test_id.slice(0, 8)}...)`}
                          {issue.risk_id && ` (risk: ${issue.risk_id.slice(0, 8)}...)`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <p className="text-amber-600 text-sm">No frameworks found. Create a framework first.</p>
            )}
          </div>

          {/* Progress */}
          <div className="mb-8 p-6 bg-white rounded-lg shadow border border-slate-200">
            <h2 className="text-lg font-medium text-slate-800 mb-2">Audit completeness</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <ProgressBar value={progress} />
              </div>
              <span className="text-lg font-semibold text-slate-700 tabular-nums">{progress}%</span>
            </div>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-8">
            {statCards.map(({ key, label, icon, href }) => {
              const value = stats[key] as number;
              const card = (
                <div className="flex items-center gap-4 p-4 bg-white rounded-lg shadow border border-slate-200 group-hover:border-slate-300 group-hover:shadow-md transition-all">
                  <div className="flex-shrink-0 p-2 rounded-lg bg-slate-100">{icon}</div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-500">{label}</p>
                    <p className="text-xl font-semibold text-slate-800 tabular-nums">{value}</p>
                  </div>
                </div>
              );
              return href ? (
                <Link key={key} href={href} className="block group">
                  {card}
                </Link>
              ) : (
                <div key={key}>{card}</div>
              );
            })}
          </div>

          {/* Gaps */}
          {(stats.risksWithoutControls > 0 || stats.controlsWithoutTests > 0 || stats.testsWithoutEvidence > 0) && (
            <div className="mb-8 p-6 bg-orange-50 rounded-lg border border-orange-200">
              <h2 className="text-lg font-medium text-orange-900 mb-4">Gaps</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {stats.risksWithoutControls > 0 && (
                  <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-orange-200">
                    <span className="text-2xl font-bold text-orange-600 tabular-nums">{stats.risksWithoutControls}</span>
                    <div>
                      <p className="font-medium text-orange-900">Risks without controls</p>
                      <p className="text-sm text-orange-700">Add controls for these risks</p>
                    </div>
                  </div>
                )}
                {stats.controlsWithoutTests > 0 && (
                  <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-orange-200">
                    <span className="text-2xl font-bold text-orange-600 tabular-nums">{stats.controlsWithoutTests}</span>
                    <div>
                      <p className="font-medium text-orange-900">Controls without tests</p>
                      <p className="text-sm text-orange-700">Define tests for these controls</p>
                    </div>
                  </div>
                )}
                {stats.testsWithoutEvidence > 0 && (
                  <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-orange-200">
                    <span className="text-2xl font-bold text-orange-600 tabular-nums">{stats.testsWithoutEvidence}</span>
                    <div>
                      <p className="font-medium text-orange-900">Tests without evidence</p>
                      <p className="text-sm text-orange-700">Attach evidence to these tests</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div>
            <h2 className="text-lg font-medium text-slate-800 mb-3">Quick links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="block p-4 bg-white rounded-lg shadow border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all"
                >
                  <span className="font-medium text-slate-700">{link.label}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
