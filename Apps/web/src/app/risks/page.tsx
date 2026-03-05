'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchResource, createResource } from '@/lib/api';

interface Risk {
  id: string;
  title: string;
  assertion?: string | null;
  rmm_level?: string | null;
  scope_id: string;
  created_at?: string;
}

interface AuditScope {
  id: string;
  name: string;
}

export default function RisksPage() {
  const [items, setItems] = useState<Risk[]>([]);
  const [scopes, setScopes] = useState<AuditScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [scopeId, setScopeId] = useState('');
  const [title, setTitle] = useState('');
  const [assertion, setAssertion] = useState('');
  const [rmmLevel, setRmmLevel] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [risks, as] = await Promise.all([
        fetchResource<Risk>('risks'),
        fetchResource<AuditScope>('audit-scopes'),
      ]);
      setItems(risks);
      setScopes(as);
      setScopeId((prev) => (prev || as[0]?.id) ?? '');
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
      await createResource<{ id: string }>('risks', {
        scope_id: scopeId,
        title: title.trim(),
        assertion: assertion.trim() || undefined,
        rmm_level: rmmLevel.trim() || undefined,
      });
      setTitle('');
      setAssertion('');
      setRmmLevel('');
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
        <h1 className="text-2xl font-semibold text-slate-800">Risks</h1>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">Audit Scope</label>
              <select
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              >
                <option value="">Select audit scope</option>
                {scopes.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assertion</label>
              <textarea
                value={assertion}
                onChange={(e) => setAssertion(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">RMM Level</label>
              <input
                type="text"
                value={rmmLevel}
                onChange={(e) => setRmmLevel(e.target.value)}
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
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Title</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Assertion</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">RMM Level</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Scope</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                    No risks yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-slate-800">{item.title}</td>
                    <td className="px-6 py-4 text-slate-600">{item.assertion ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{item.rmm_level ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {scopes.find((s) => s.id === item.scope_id)?.name ?? item.scope_id}
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
