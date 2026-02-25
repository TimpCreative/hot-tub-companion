'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';

interface AdminLayoutClientProps {
  children: React.ReactNode;
  navItems: { label: string; href: string; comingPhase?: number }[];
  basePath: string;
}

export default function AdminLayoutClient({
  children,
  navItems,
  basePath,
}: AdminLayoutClientProps) {
  const { user, loading: authLoading } = useAuth();
  const { config, loading: tenantLoading, error } = useTenant();
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
    router.replace(`/auth/login?redirect=${encodeURIComponent(pathname || basePath + '/dashboard')}`);
    return null;
  }

  const title = config?.name || (config?.slug ? config.slug.charAt(0).toUpperCase() + config.slug.slice(1) : 'Admin');

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar navItems={navItems} basePath={basePath} title={title} />
      <div className="flex-1 flex flex-col">
        <Header tenantName={config?.name} logoUrl={config?.branding?.logoUrl} />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
