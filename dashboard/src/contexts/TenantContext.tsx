'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface TenantConfig {
  tenantId: string;
  name: string;
  slug: string;
  branding: {
    primaryColor?: string;
    secondaryColor?: string;
    accentColor?: string;
    logoUrl?: string;
    iconUrl?: string;
  };
  features: Record<string, boolean>;
  serviceTypes: string[];
  sanitizationSystems: string[];
}

interface TenantContextType {
  tenantSlug: string | null;
  config: TenantConfig | null;
  apiKey: string | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({
  children,
  tenantSlug: initialSlug,
}: {
  children: React.ReactNode;
  tenantSlug: string | null;
}) {
  const [tenantSlug] = useState<string | null>(initialSlug);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(!!initialSlug);
  const [error, setError] = useState<string | null>(null);

  const apiKey =
    typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TENANT_API_KEY || null : null;

  useEffect(() => {
    if (!initialSlug || !apiKey) {
      setLoading(false);
      return;
    }

    const baseURL =
      (process.env.NEXT_PUBLIC_API_URL || 'https://api.hottubcompanion.com') + '/api/v1';
    fetch(`${baseURL}/tenant/config`, {
      headers: { 'x-tenant-key': apiKey },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch tenant config');
        return res.json();
      })
      .then((json) => setConfig(json.data))
      .catch((err) => setError(err.message || 'Failed to load tenant'))
      .finally(() => setLoading(false));
  }, [initialSlug, apiKey]);

  return (
    <TenantContext.Provider
      value={{
        tenantSlug,
        config,
        apiKey,
        loading,
        error,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
