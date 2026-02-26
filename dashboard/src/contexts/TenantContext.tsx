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
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

/**
 * Tenant config is fetched server-side via /api/dashboard/tenant-config,
 * which looks up the API key from the database by slug. The API key
 * is never exposed to the client. Only tenant config.env files (mobile)
 * contain API keys.
 */
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

  useEffect(() => {
    if (!initialSlug) {
      setLoading(false);
      return;
    }

    fetch(`/api/dashboard/tenant-config?slug=${encodeURIComponent(initialSlug)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          const msg = json?.error ?? json?.message ?? 'Failed to fetch tenant config';
          throw new Error(typeof msg === 'string' ? msg : 'Failed to fetch tenant config');
        }
        return json;
      })
      .then((json) => setConfig(json.data ?? json))
      .catch((err) => setError(err.message || 'Failed to load tenant'))
      .finally(() => setLoading(false));
  }, [initialSlug]);

  return (
    <TenantContext.Provider
      value={{
        tenantSlug,
        config,
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
