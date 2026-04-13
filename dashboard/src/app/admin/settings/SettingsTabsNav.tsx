'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';

const TABS_ALL = [
  { href: '/admin/settings', label: 'General', exact: true, needsSubscriptions: false },
  { href: '/admin/settings/subscriptions', label: 'Subscriptions', exact: false, needsSubscriptions: true },
] as const;

function tabActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsTabsNav() {
  const pathname = usePathname() || '';
  const { permissions } = useAdminPermissions();
  const tabs = TABS_ALL.filter(
    (t) => !t.needsSubscriptions || permissions?.can_manage_subscriptions === true
  );

  return (
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex flex-wrap gap-1 sm:gap-6" aria-label="Settings sections">
        {tabs.map((tab) => {
          const active = tabActive(pathname, tab.href, tab.exact);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition-colors ${
                active
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
