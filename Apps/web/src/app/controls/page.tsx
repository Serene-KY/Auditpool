'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchResource, createResource } from '@/lib/api';

interface Control {
  id: string;
  control_code: string;
  frequency?: string | null;
  control_type?: string | null;
  risk_id: string;
  created_at?: string;
}

interface Risk {
  id: string;
  title: string;
}

export default function ControlsPage() {
  const [items, setItems] = useState<Control[]>([]);
  const [risks, setRisks] = useState<Risk[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [controlCode, setControlCode] = useState('');
  const [frequency, setFrequency] = useState('');
  const [controlType, setControlType] = useState('');
  const [riskId, setRiskId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [controls, r] = await Promise.all([
        fetchResource<Control>('controls'),
        fetchResource<Risk>('risks'),
      ]);
      setItems(controls);
      setRisks(r);
      if (r.length > 0) setRiskId((prev) => prev || r[0].id);
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
      await createResource<{ id: string }>('controls', {
        control_code: controlCode.trim(),
        frequency: frequency.trim() || undefined,
        control_type: controlType.trim() || undefined,
        risk_id: riskId,
      });
      setControlCode('');
      setFrequency('');
      setControlType('');
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
        <h1 className="text-2xl font-semibold text-slate-800">Controls</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
        >
          Add
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-4 bg-white rounded-lg shadow border border-slate-200">
          <div className="grid gap-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Risk</label>
              <select
                value={riskId}
                onChange={(e) => setRiskId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              >
                <option value="">Select risk</option>
                {risks.map((r) => (
                  <option key={r.id} value={r.id}>{r.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
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
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Control Code</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Frequency</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Control Type</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">Risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No controls yet</td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-slate-800">{item.control_code}</td>
                    <td className="px-6 py-4 text-slate-600">{item.frequency ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">{item.control_type ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600">
                      {risks.find((r) => r.id === item.risk_id)?.title ?? item.risk_id}
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
