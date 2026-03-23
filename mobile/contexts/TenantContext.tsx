import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

export type OnboardingStepId = 'brand' | 'modelPick' | 'sanitizer';

export interface WelcomeBlock {
  greetingLine1: string;
  greetingLine2: string;
}

export interface TenantOnboardingConfig {
  version: number;
  allowSkip: boolean;
  steps: { id: OnboardingStepId; enabled: boolean }[];
  welcomeBlock?: WelcomeBlock;
}

export type HomeWidgetType = 'dealer_card' | 'tips_list' | 'product_strip';

export interface HomeWidget {
  id: string;
  type: HomeWidgetType;
  enabled: boolean;
  order: number;
  props: Record<string, unknown>;
}

export interface QuickLink {
  id: string;
  title: string;
  subtitle?: string;
  iconKey: string;
  targetRoute: string;
  iconColor?: string;
  iconBgColor?: string;
  enabled: boolean;
  order: number;
}

export interface HomeDashboardConfig {
  version: number;
  quickLinks: QuickLink[];
  quickLinksLayout: 'single' | 'double';
  widgets: HomeWidget[];
}

export interface DealerContact {
  phone: string | null;
  address: string | null;
}

interface TenantConfig {
  tenantId: string;
  name: string;
  slug: string;
  branding: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontFamily: string;
    logoUrl?: string;
    iconUrl?: string;
  };
  features: Record<string, boolean>;
  serviceTypes: unknown[];
  sanitizationSystems: string[];
  onboarding?: TenantOnboardingConfig;
  homeDashboard?: HomeDashboardConfig;
  dealerContact?: DealerContact;
  termsUrl?: string | null;
  privacyUrl?: string | null;
}

interface TenantContextType {
  config: TenantConfig | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantContextType>({
  config: null,
  loading: true,
  error: null,
});

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.get('/tenant/config') as { data?: TenantConfig };
        setConfig(data.data ?? (data as unknown as TenantConfig));
      } catch (err: unknown) {
        setError(err && typeof err === 'object' && 'error' in err
          ? (err as { error: { message?: string } }).error?.message ?? 'Failed to load config'
          : 'Failed to load config');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <TenantContext.Provider value={{ config, loading, error }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}
