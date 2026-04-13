'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';

type TabDef = {
  href: string;
  label: string;
  exact: boolean;
  /** Hide unless user can manage store settings (POS, branding APIs). */
  requiresManageSettings?: boolean;
  /** Hide unless user can manage subscriptions or store settings (Connect / billing UI). */
  requiresSubsOrSettings?: boolean;
};

const TABS: TabDef[] = [
  { href: '/admin/settings', label: 'General', exact: true },
  { href: '/admin/settings/pos', label: 'POS integration', exact: false, requiresManageSettings: true },
  {
    href: '/admin/settings/subscriptions',
    label: 'Subscriptions',
    exact: false,
    requiresSubsOrSettings: true,
  },
];

function tabActive(pathname: string, href: string, exact: boolean): boolean {
  if (exact) {
    return pathname === href || pathname === `${href}/`;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SettingsTabsNav() {
  const pathname = usePathname() || '';
  const { permissions, loading: permLoading } = useAdminPermissions();

  const tabs = TABS.filter((t) => {
    if (permLoading) return true;
    if (t.requiresManageSettings && !permissions?.can_manage_settings) return false;
    if (
      t.requiresSubsOrSettings &&
      !permissions?.can_manage_subscriptions &&
      !permissions?.can_manage_settings
    ) {
      return false;
    }
    return true;
  });

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
