'use client';

import { Fragment, useState, useEffect, useCallback } from 'react';
import { fetchResource, createResource, reviewEvidence, type ReviewEvidenceResult } from '@/lib/api';

interface Test {
  id: string;
  test_type?: string | null;
  procedure_steps?: unknown;
  sample_size?: number | null;
  control_id: string;
  created_at?: string;
}

interface Control {
  id: string;
  control_code: string;
}

function formatProcedureSteps(steps: unknown): string {
  if (Array.isArray(steps)) return steps.map(String).join(', ');
  if (typeof steps === 'string') return steps;
  return steps != null ? String(steps) : '—';
}

export default function TestsPage() {
  const [items, setItems] = useState<Test[]>([]);
  const [controls, setControls] = useState<Control[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testType, setTestType] = useState('manual');
  const [procedureSteps, setProcedureSteps] = useState('');
  const [sampleSize, setSampleSize] = useState(10);
  const [controlId, setControlId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reviewingTestId, setReviewingTestId] = useState<string | null>(null);
  const [reviewResults, setReviewResults] = useState<Record<string, ReviewEvidenceResult>>({});
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tests, c] = await Promise.all([
        fetchResource<Test>('tests'),
        fetchResource<Control>('controls'),
      ]);
      setItems(tests);
      setControls(c);
      if (!controlId && c.length > 0) setControlId(c[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const steps = procedureSteps.trim()
        ? procedureSteps.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      await createResource<{ id: string }>('tests', {
        test_type: testType,
        procedure_steps: steps,
        sample_size: sampleSize,
        control_id: controlId,
      });
      setProcedureSteps('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReviewEvidence(testId: string) {
    setReviewingTestId(testId);
    setError(null);
    try {
      const result = await reviewEvidence(testId);
      setReviewResults((prev) => ({ ...prev, [testId]: result }));
      setExpandedReviewId(testId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to review evidence');
    } finally {
      setReviewingTestId(null);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Tests</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Add
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 bg-white rounded-lg shadow border border-slate-200"
        >
          <div className="grid gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Control</label>
              <select
                value={controlId}
                onChange={(e) => setControlId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              >
                <option value="">Select control</option>
                {controls.map((c) => (
                  <option key={c.id} value={c.id}>{c.control_code}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Test Type</label>
              <input
                type="text"
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Procedure Steps (comma-separated)</label>
              <textarea
                value={procedureSteps}
                onChange={(e) => setProcedureSteps(e.target.value)}
                rows={2}
                placeholder="Step 1, Step 2, Step 3"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Sample Size</label>
              <input
                type="number"
                value={sampleSize}
                onChange={(e) => setSampleSize(Number(e.target.value) || 0)}
                min={1}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {loading && <p className="text-slate-500">Loading...</p>}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {!loading && (
        <div className="bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Test Type</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Sample Size</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Procedure Steps</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Control</th>
                <th className="px-6 py-3 text-right text-sm font-medium text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    No tests yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <Fragment key={item.id}>
                    <tr>
                      <td className="px-6 py-4 text-slate-800">{item.test_type ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600 tabular-nums">{item.sample_size ?? '—'}</td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={formatProcedureSteps(item.procedure_steps)}>
                        {formatProcedureSteps(item.procedure_steps)}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {controls.find((c) => c.id === item.control_id)?.control_code ?? item.control_id}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleReviewEvidence(item.id)}
                          disabled={!!reviewingTestId}
                          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {reviewingTestId === item.id ? (
                            <>
                              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Reviewing…
                            </>
                          ) : (
                            'Review Evidence'
                          )}
                        </button>
                      </td>
                    </tr>
                    {expandedReviewId === item.id && reviewResults[item.id] && (
                      <tr key={`${item.id}-review`}>
                        <td colSpan={5} className="bg-slate-50 p-0">
                          <div className="px-6 py-4">
                            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-lg">
                                  {reviewResults[item.id].sufficient ? '✅' : '❌'}
                                </span>
                                <span className="font-medium text-slate-800">
                                  Evidence {reviewResults[item.id].sufficient ? 'Sufficient' : 'Insufficient'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setExpandedReviewId(null)}
                                  className="ml-auto text-slate-500 hover:text-slate-700"
                                  aria-label="Close"
                                >
                                  ✕
                                </button>
                              </div>
                              <p className="text-slate-600 text-sm mb-3">{reviewResults[item.id]?.reasoning ?? ''}</p>
                              {Array.isArray(reviewResults[item.id]?.recommendations) && reviewResults[item.id].recommendations.length > 0 && (
                                <div>
                                  <span className="text-sm font-medium text-slate-700">Recommendations:</span>
                                  <ul className="mt-1 list-disc list-inside text-sm text-slate-600 space-y-0.5">
                                    {reviewResults[item.id].recommendations.map((rec, i) => (
                                      <li key={i}>{rec}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
