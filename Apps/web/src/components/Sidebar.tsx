'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/frameworks', label: 'Frameworks' },
  { href: '/audit-scopes', label: 'Audit Scopes' },
  { href: '/risks', label: 'Risks' },
  { href: '/controls', label: 'Controls' },
  { href: '/tests', label: 'Tests' },
  { href: '/evidence', label: 'Evidence' },
  { href: '/conclusions', label: 'Conclusions' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-slate-900 text-white flex flex-col min-h-screen">
      <div className="p-6 border-b border-slate-700">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Image
            src="/cropped-AUDITPOOL-FAVICO.png"
            alt="Auditpool"
            width={32}
            height={32}
          />
          <span className="font-semibold text-lg">Auditpool</span>
        </Link>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-2 rounded-lg transition-colors ${
                isActive ? 'bg-slate-700 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
