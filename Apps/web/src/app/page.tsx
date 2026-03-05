'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';

const TENANT_ID = '69c1bc8b-63d9-4753-97ce-7fa2be21e41d';

interface Framework {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  created_at: string;
  version: number;
}

export default function Home() {
  const [frameworks, setFrameworks] = useState<Framework[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    fetch(`${apiUrl}/frameworks`, {
      headers: {
        'x-tenant-id': TENANT_ID,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setFrameworks(data);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch frameworks');
        setFrameworks([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
        <Image
          src="/cropped-AUDITPOOL-FAVICO.png"
          alt="Auditpool logo"
          width={200}
          height={200}
          style={{ maxWidth: 200, width: 'auto', height: 'auto' }}
          priority
        />
      </div>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0 }}>Auditpool</h1>
      <section style={{ width: '100%', maxWidth: 672 }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: 12 }}>Frameworks</h2>
        {loading && <p style={{ color: '#6b7280' }}>Loading frameworks...</p>}
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        {!loading && !error && (
          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
            <thead>
              <tr style={{ backgroundColor: '#f3f4f6' }}>
                <th style={{ border: '1px solid #d1d5db', padding: '8px 16px', textAlign: 'left' }}>Name</th>
                <th style={{ border: '1px solid #d1d5db', padding: '8px 16px', textAlign: 'left' }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {frameworks.length === 0 ? (
                <tr>
                  <td colSpan={2} style={{ border: '1px solid #d1d5db', padding: 16, textAlign: 'center', color: '#6b7280' }}>
                    No frameworks yet
                  </td>
                </tr>
              ) : (
                frameworks.map((fw) => (
                  <tr key={fw.id}>
                    <td style={{ border: '1px solid #d1d5db', padding: '8px 16px' }}>{fw.name}</td>
                    <td style={{ border: '1px solid #d1d5db', padding: '8px 16px' }}>{fw.description ?? '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
