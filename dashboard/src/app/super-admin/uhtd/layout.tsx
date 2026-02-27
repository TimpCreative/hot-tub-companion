'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const UHTD_NAV = [
  { label: 'Overview', href: '/super-admin/uhtd' },
  { label: 'Brands', href: '/super-admin/uhtd/brands' },
  { label: 'Parts', href: '/super-admin/uhtd/parts' },
  { label: 'Comps', href: '/super-admin/uhtd/comps' },
  { label: 'Categories', href: '/super-admin/uhtd/categories' },
  { label: 'Qualifiers', href: '/super-admin/uhtd/qualifiers' },
  { label: 'Review Queue', href: '/super-admin/uhtd/review-queue' },
  { label: 'Import', href: '/super-admin/uhtd/import' },
  { label: 'Audit Log', href: '/super-admin/uhtd/audit-log' },
];

export default function UhtdLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/super-admin/uhtd') {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <div className="flex gap-6">
      <nav className="w-48 flex-shrink-0">
        <div className="sticky top-4 space-y-1">
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
        </div>
      </nav>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
