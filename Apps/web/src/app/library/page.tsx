'use client';

import { useState, useEffect } from 'react';
import {
  fetchLibraryFrameworks,
  fetchTenants,
  importFrameworkFromLibrary,
  type Framework,
  type Tenant,
} from '@/lib/api';

export default function LibraryPage() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchLibraryFrameworks()
      .then(setFrameworks)
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to load frameworks');
        setFrameworks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchTenants()
      .then((list) => {
        setTenants(list);
        const nonSystem = list.filter((t) => t.id !== '00000000-0000-0000-0000-000000000000');
        if (nonSystem.length > 0 && !selectedTenantId) {
          setSelectedTenantId(nonSystem[0].id);
        }
      })
      .catch(() => setTenants([]));
  }, []);

  const handleImport = async (frameworkId: string) => {
    if (!selectedTenantId) {
      setError('Please select a tenant to import into');
      return;
    }
    setImportingId(frameworkId);
    setError(null);
    try {
      await importFrameworkFromLibrary(frameworkId, selectedTenantId);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  return (
    <div className="p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Framework Library</h1>
          <p className="mt-1 text-sm text-slate-600">
            Import industry frameworks with scopes, risks, and controls into your tenant
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label htmlFor="tenant-select" className="text-sm font-medium text-slate-700">
            Import to:
          </label>
          <select
            id="tenant-select"
            value={selectedTenantId}
            onChange={(e) => setSelectedTenantId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">Select tenant</option>
            {tenants.filter((t) => t.id !== '00000000-0000-0000-0000-000000000000').map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        </div>
      ) : frameworks.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-slate-600">No frameworks in the library.</p>
          <p className="mt-1 text-sm text-slate-500">
            Run <code className="rounded bg-slate-100 px-1 py-0.5">pnpm run seed:frameworks</code> in
            apps/api to populate.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {frameworks.map((fw) => (
            <div
              key={fw.id}
              className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-slate-900">{fw.name}</h2>
              <p className="mt-2 flex-1 text-sm text-slate-600 line-clamp-3">
                {fw.description || 'No description available.'}
              </p>
              <div className="mt-6">
                <button
                  onClick={() => handleImport(fw.id)}
                  disabled={!selectedTenantId || importingId === fw.id}
                  className="w-full rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {importingId === fw.id ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Importing…
                    </span>
                  ) : (
                    'Import'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
