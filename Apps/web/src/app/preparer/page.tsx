'use client';

import { useState } from 'react';
import { runPreparer } from '@/lib/api';

export default function PreparerPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    summary: string;
    suggestedControls: Array<{ riskId: string; controlCode: string; description?: string }>;
  } | null>(null);

  async function handleAnalyse() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await runPreparer();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preparation failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">AI Preparer Agent</h1>
      </div>

      <button
        type="button"
        onClick={handleAnalyse}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
            Analyseren…
          </>
        ) : (
          'Analyse mijn audit en stel controls voor'
        )}
      </button>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {result && (
        <div className="mt-8 bg-white rounded-lg shadow border border-slate-200 overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-medium text-slate-800 mb-2">Samenvatting</h2>
            <p className="text-slate-600 whitespace-pre-wrap">{result.summary}</p>

            {result.suggestedControls.length > 0 && (
              <div className="mt-6">
                <h2 className="text-lg font-medium text-slate-800 mb-3">Voorgestelde controls</h2>
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
  );
}
