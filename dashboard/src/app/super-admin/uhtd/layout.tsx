'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const UHTD_NAV = [
  { label: 'Overview', href: '/super-admin/uhtd' },
  { label: 'Brands', href: '/super-admin/uhtd/brands' },
  { label: 'Model Lines', href: '/super-admin/uhtd/model-lines' },
  { label: 'Spas', href: '/super-admin/uhtd/spas' },
  { label: 'Parts', href: '/super-admin/uhtd/parts' },
  { label: 'Comps', href: '/super-admin/uhtd/comps' },
  { label: 'Categories', href: '/super-admin/uhtd/categories' },
  { label: 'Qualifiers', href: '/super-admin/uhtd/qualifiers' },
  { label: 'Review Queue', href: '/super-admin/uhtd/review-queue' },
];

const MORE_NAV = [
  { label: 'Import', href: '/super-admin/uhtd/import' },
  { label: 'Media', href: '/super-admin/uhtd/media' },
  { label: 'Audit Log', href: '/super-admin/uhtd/audit-log' },
];

export default function UhtdLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(() => {
    return MORE_NAV.some((item) => pathname.startsWith(item.href));
  });

  const isActive = (href: string) => {
    if (href === '/super-admin/uhtd') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  const isMoreActive = MORE_NAV.some((item) => pathname.startsWith(item.href));

  return (
    <div className="flex gap-6 items-start">
      <nav className="w-48 flex-shrink-0">
        <div className="sticky top-6 space-y-1">
          {UHTD_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* More dropdown */}
          <div className="pt-2">
            <button
              onClick={() => setMoreOpen(!moreOpen)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isMoreActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span>More</span>
              <svg
                className={`w-4 h-4 transition-transform ${moreOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {moreOpen && (
              <div className="mt-1 ml-3 space-y-1 border-l-2 border-gray-200 pl-2">
                {MORE_NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </nav>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
