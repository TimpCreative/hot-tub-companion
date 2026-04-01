'use client';

import type { ReactNode } from 'react';

interface MobilePreviewShellProps {
  title?: string;
  children: ReactNode;
}

export function MobilePreviewShell({
  title = 'App preview',
  children,
}: MobilePreviewShellProps) {
  return (
    <div
      className="sticky top-6 self-start shrink-0 rounded-3xl border border-gray-200 bg-gray-50 p-5 shadow-sm"
      style={{ width: 360, maxHeight: 'calc(100vh - 3rem)' }}
    >
      <div className="overflow-hidden rounded-[28px] border border-gray-300 bg-white">
        <div className="border-b border-gray-200 bg-gray-700 px-4 py-2 text-center">
          <span className="text-xs font-medium text-white">{title}</span>
        </div>
        <div className="overflow-y-auto bg-gray-50" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
