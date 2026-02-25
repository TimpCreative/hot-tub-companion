'use client';

import React from 'react';
import { useTenant } from '@/contexts/TenantContext';

export default function AdminDashboardPage() {
  const { config } = useTenant();
  const name = config?.name || 'Retailer';

  return (
    <div>
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">
        Welcome to {name} Admin
      </h2>
      <p className="text-gray-600">
        Your admin dashboard. Use the sidebar to navigate.
      </p>
    </div>
  );
}
