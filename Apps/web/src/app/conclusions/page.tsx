'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchResource, createResource } from '@/lib/api';

interface Conclusion {
  id: string;
  overall_result: string;
  summary: string;
  test_id: string;
  created_at?: string;
}

interface Test {
  id: string;
  test_type?: string;
  control_id?: string;
}

export default function ConclusionsPage() {
  const [items, setItems] = useState<Conclusion[]>([]);
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [testId, setTestId] = useState('');
  const [overallResult, setOverallResult] = useState('pass');
  const [summary, setSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [conclusions, t] = await Promise.all([
        fetchResource<Conclusion>('conclusions'),
        fetchResource<Test>('tests'),
      ]);
      setItems(conclusions);
      setTests(t);
      if (!testId && t.length > 0) setTestId(t[0].id);
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
      await createResource<{ id: string }>('conclusions', {
        test_id: testId,
        conclusion: conclusion.trim(),
      });
      setConclusion('');
      setShowForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Conclusions</h1>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Test</label>
              <select
                value={testId}
                onChange={(e) => setTestId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              >
                <option value="">Select test</option>
                {tests.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Overall Result</label>
              <select
                value={overallResult}
                onChange={(e) => setOverallResult(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              >
                <option value="pass">Pass</option>
                <option value="fail">Fail</option>
                <option value="partial">Partial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Summary</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                required
                rows={3}
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
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Overall Result</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Summary</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Test</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No conclusions yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-slate-800">{item.overall_result}</td>
                    <td className="px-6 py-4 text-slate-600">{item.summary}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {tests.find((t) => t.id === item.test_id)?.test_type ?? item.test_id}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
