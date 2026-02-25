'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from './Button';

interface HeaderProps {
  title?: string;
  logoUrl?: string;
  tenantName?: string;
}

export function Header({ title, logoUrl, tenantName }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        {logoUrl && (
          <img src={logoUrl} alt={tenantName || 'Logo'} className="h-8 object-contain" />
        )}
        <h1 className="text-lg font-semibold text-gray-900">{title || tenantName || 'Dashboard'}</h1>
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <>
            <span className="text-sm text-gray-600">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={logout}>
              Sign Out
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
