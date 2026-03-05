'use client';

import Link from 'next/link';

const links = [
  { href: '/frameworks', label: 'Frameworks' },
  { href: '/audit-scopes', label: 'Audit Scopes' },
  { href: '/risks', label: 'Risks' },
  { href: '/controls', label: 'Controls' },
  { href: '/tests', label: 'Tests' },
  { href: '/evidence', label: 'Evidence' },
  { href: '/conclusions', label: 'Conclusions' },
];

export default function DashboardPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="block p-6 bg-white rounded-lg shadow border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all"
          >
            <span className="font-medium text-slate-700">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
