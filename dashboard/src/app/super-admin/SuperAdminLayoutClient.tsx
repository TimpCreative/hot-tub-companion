'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Sidebar } from '@/components/ui/Sidebar';
import { Header } from '@/components/ui/Header';

interface SuperAdminLayoutClientProps {
  children: React.ReactNode;
  navItems: { label: string; href: string; comingPhase?: number }[];
  basePath: string;
}

export default function SuperAdminLayoutClient({
  children,
  navItems,
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar navItems={navItems} basePath={basePath} title="Super Admin" />
      <div className="flex-1 flex flex-col">
        <Header title="Super Admin" />
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
