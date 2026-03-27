'use client';

import React, { useEffect, useMemo } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';

interface NavItem {
  label: string;
  href: string;
  comingPhase?: number;
  requiresCanManageUsers?: boolean;
}

interface AdminLayoutClientProps {
  children: React.ReactNode;
  navItems: NavItem[];
  basePath: string;
}

function getPageLabelFromPath(pathname: string, basePath: string, navItems: NavItem[]): string {
  const relative = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length)
    : pathname;
  const segments = relative.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';
  const first = `/${segments[0]}`;
  const matched = navItems.find((item) => item.href === first);
  if (matched?.label) return matched.label;
  return segments[0]
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function AdminLayoutClient({
  children,
  navItems,
  basePath,
}: AdminLayoutClientProps) {
  const { user, loading: authLoading } = useAuth();
  const { config, loading: tenantLoading, error } = useTenant();
  const { permissions, loading: permissionsLoading } = useAdminPermissions();
  const pathname = usePathname();
  const router = useRouter();

  const filteredNavItems = useMemo(() => {
    return navItems.filter((item) => {
      if (item.requiresCanManageUsers && !permissions?.can_manage_users) return false;
      return true;
    });
  }, [navItems, permissions?.can_manage_users]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    router.replace(`/auth/login?redirect=${encodeURIComponent(pathname || basePath + '/dashboard')}`);
    return null;
  }

  if (!tenantLoading && error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="rounded-lg bg-red-50 p-6 text-red-700 max-w-md">
          <p className="font-medium">Could not load tenant</p>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const title = config?.name || (config?.slug ? config.slug.charAt(0).toUpperCase() + config.slug.slice(1) : 'Admin');

  useEffect(() => {
    const pageLabel = getPageLabelFromPath(pathname || `${basePath}/dashboard`, basePath, navItems);
    const accountLabel = config?.name || 'Retailer Admin';
    document.title = `${pageLabel} - ${accountLabel} - Hot Tub Companion Dashboard`;
  }, [pathname, basePath, navItems, config?.name]);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--main-bg)' }}>
      <Sidebar navItems={filteredNavItems} basePath={basePath} title={title} />
      <div className="flex-1 flex flex-col">
        <Header tenantName={config?.name} logoUrl={config?.branding?.logoUrl} />
        <main className="flex-1 p-6 overflow-auto" style={{ color: 'var(--foreground)' }}>{children}</main>
      </div>
    </div>
  );
}
