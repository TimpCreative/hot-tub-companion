'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { createTenantApiClient } from '@/services/api';

export interface AdminPermissions {
  role: string;
  can_manage_users: boolean;
  can_view_customers: boolean;
  can_view_orders: boolean;
  can_manage_products: boolean;
  can_manage_content: boolean;
  can_manage_service_requests: boolean;
  can_send_notifications: boolean;
  can_view_analytics: boolean;
  can_manage_subscriptions: boolean;
  can_manage_settings: boolean;
}

interface AdminPermissionsContextType {
  permissions: AdminPermissions | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextType | undefined>(undefined);

export function AdminPermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, getIdToken } = useAuth();
  const [permissions, setPermissions] = useState<AdminPermissions | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const api = createTenantApiClient(() => getIdToken());
      const res = (await api.get('/admin/me')) as { data?: AdminPermissions; error?: { message?: string } };
      if (res?.data) {
        setPermissions(res.data);
      } else {
        setPermissions(null);
      }
    } catch {
      setPermissions(null);
    } finally {
      setLoading(false);
    }
  }, [user, getIdToken]);

  useEffect(() => {
    void fetchPermissions();
  }, [fetchPermissions]);

  return (
    <AdminPermissionsContext.Provider value={{ permissions, loading, refetch: fetchPermissions }}>
      {children}
    </AdminPermissionsContext.Provider>
  );
}

export function useAdminPermissions() {
  const ctx = useContext(AdminPermissionsContext);
  if (!ctx) throw new Error('useAdminPermissions must be used within AdminPermissionsProvider');
  return ctx;
}
