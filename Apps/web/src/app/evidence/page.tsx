'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchResource, createResource } from '@/lib/api';

interface Evidence {
  id: string;
  file_name?: string | null;
  file_path?: string | null;
  sha256: string;
  created_at?: string;
}

export default function EvidencePage() {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [fileName, setFileName] = useState('');
  const [filePath, setFilePath] = useState('');
  const [sha256, setSha256] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const evidence = await fetchResource<Evidence>('evidence');
      setItems(evidence);
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
      await createResource<{ id: string }>('evidence', {
        file_name: fileName.trim(),
        file_path: filePath.trim() || undefined,
        sha256: sha256.trim(),
      });
      setFileName('');
      setFilePath('');
      setSha256('');
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
        <h1 className="text-2xl font-semibold text-slate-800">Evidence</h1>
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
              <label className="block text-sm font-medium text-slate-700 mb-1">File Name</label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                required
                placeholder="e.g. mfa-screenshot.png"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">File Path</label>
              <input
                type="text"
                value={filePath}
                onChange={(e) => setFilePath(e.target.value)}
                placeholder="e.g. /evidence/mfa"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">SHA256</label>
              <input
                type="text"
                value={sha256}
                onChange={(e) => setSha256(e.target.value)}
                required
                placeholder="Hash of the evidence file"
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
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">File Name</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">File Path</th>
                <th className="px-6 py-3 text-left text-sm font-medium text-slate-700">SHA256</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-8 text-center text-slate-500">
                    No evidence yet
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-6 py-4 text-slate-800">{item.file_name ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">{item.file_path ?? '—'}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono text-sm">{item.sha256}</td>
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
