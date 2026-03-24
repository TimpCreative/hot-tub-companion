'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useUnsavedChanges } from '@/contexts/UnsavedChangesContext';

interface NavItem {
  label: string;
  href: string;
  comingPhase?: number;
  icon?: React.ReactNode;
}

interface SidebarProps {
  navItems: NavItem[];
  bottomItems?: NavItem[];
  basePath: string;
  title: string;
}

export function Sidebar({ navItems, bottomItems, basePath, title }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { confirmNavigate } = useUnsavedChanges();

  const renderNavItem = (item: NavItem) => {
    const href = item.href.startsWith('/') ? item.href : `${basePath}${item.href}`;
    const isActive = pathname === href || pathname.startsWith(href + '/');
    return (
      <Link
        key={item.href}
        href={href}
        onClick={(e) => {
          if (isActive) {
            e.preventDefault();
            return;
          }
          e.preventDefault();
          confirmNavigate(href, () => router.push(href));
        }}
        className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-colors ${
          isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
        }`}
      >
        {item.icon && <span className="w-5 h-5">{item.icon}</span>}
        {item.label}
        {item.comingPhase !== undefined && (
          <span className="ml-2 text-xs text-gray-500">(Phase {item.comingPhase})</span>
        )}
      </Link>
    );
  };

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map(renderNavItem)}
      </nav>
      {bottomItems && bottomItems.length > 0 && (
        <div className="p-4 border-t border-gray-700 space-y-1">
          {bottomItems.map(renderNavItem)}
        </div>
      )}
    </aside>
  );
}
