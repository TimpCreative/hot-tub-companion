'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  comingPhase?: number;
}

interface SidebarProps {
  navItems: NavItem[];
  basePath: string;
  title: string;
}

export function Sidebar({ navItems, basePath, title }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="w-64 min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const href = item.href.startsWith('/') ? item.href : `${basePath}${item.href}`;
          const isActive = pathname === href;
          return (
            <Link
              key={item.href}
              href={href}
              className={`block px-4 py-2 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.label}
              {item.comingPhase !== undefined && (
                <span className="ml-2 text-xs text-gray-500">(Phase {item.comingPhase})</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
