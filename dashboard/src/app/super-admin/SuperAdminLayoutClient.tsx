'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';

interface NavItem {
  label: string;
  href: string;
  comingPhase?: number;
  icon?: React.ReactNode;
}

interface SuperAdminLayoutClientProps {
  children: React.ReactNode;
  navItems: NavItem[];
  bottomItems?: NavItem[];
  basePath: string;
}

function getPageLabelFromPath(pathname: string, basePath: string, navItems: NavItem[], bottomItems?: NavItem[]): string {
  const allNav = [...navItems, ...(bottomItems || [])];
  const relative = pathname.startsWith(basePath)
    ? pathname.slice(basePath.length)
    : pathname;
  const segments = relative.split('/').filter(Boolean);
  if (segments.length === 0) return 'Dashboard';
  const first = `/${segments[0]}`;
  const matched = allNav.find((item) => item.href === first);
  if (matched?.label) return matched.label;
  return segments[0]
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function SuperAdminLayoutClient({
  children,
  navItems,
  bottomItems,
  basePath,
}: SuperAdminLayoutClientProps) {
  const { user, loading: authLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    router.replace(`/auth/login?redirect=${encodeURIComponent(pathname || basePath + '/dashboard')}&admin=1`);
    return null;
  }

  useEffect(() => {
    const pageLabel = getPageLabelFromPath(pathname || `${basePath}/dashboard`, basePath, navItems, bottomItems);
    document.title = `${pageLabel} - Super Admin - Hot Tub Companion Dashboard`;
  }, [pathname, basePath, navItems, bottomItems]);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: 'var(--main-bg)' }}>
      <Sidebar navItems={navItems} bottomItems={bottomItems} basePath={basePath} title="Super Admin" />
      <div className="flex-1 flex flex-col">
        <Header title="Super Admin" />
        <main className="flex-1 p-6 overflow-auto" style={{ color: 'var(--foreground)' }}>{children}</main>
      </div>
    </div>
  );
}
