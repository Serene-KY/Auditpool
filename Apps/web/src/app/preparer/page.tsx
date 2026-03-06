'use client';

import { useState, useEffect } from 'react';
import { fetchTenants, runPreparer, type Tenant } from '@/lib/api';

export default function PreparerPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    summary: string;
    suggestedControls: Array<{ riskId: string; controlCode: string; description?: string }>;
  } | null>(null);

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

  async function handleAnalyse() {
    if (!selectedTenantId) {
      setError('Please select a tenant first');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await runPreparer(selectedTenantId);
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">AI Preparer Agent</h1>

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

        <button
          type="button"
          onClick={handleAnalyse}
          disabled={loading || !selectedTenantId}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {loading ? (
            <>
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Analysing...
            </>
          ) : (
            'Analyse Audit & Suggest Controls'
          )}
        </button>

        {error && <p className="mt-4 text-red-600">{error}</p>}

        {result && (
          <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-medium text-slate-800 mb-2">Summary</h2>
              <p className="text-slate-600 whitespace-pre-wrap">{result.summary}</p>

              {result.suggestedControls.length > 0 && (
                <div className="mt-6">
                  <h2 className="text-lg font-medium text-slate-800 mb-3">Suggested Controls</h2>
                  <ul className="space-y-3">
                    {result.suggestedControls.map((c, i) => (
                      <li
                        key={c.riskId + c.controlCode + i}
                        className="rounded-lg border border-slate-200 p-4 bg-slate-50"
                      >
                        <span className="font-medium text-slate-800">{c.controlCode}</span>
                        {c.description && (
                          <p className="mt-1 text-sm text-slate-600">{c.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
