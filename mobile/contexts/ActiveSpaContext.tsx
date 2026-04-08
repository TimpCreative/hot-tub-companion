import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useTenant } from './TenantContext';

export type SpaProfileListItem = {
  id: string;
  isPrimary?: boolean;
  nickname?: string | null;
  brand?: string | null;
  modelLine?: string | null;
  model?: string | null;
  year?: number | null;
};

function pickPrimary(profiles: SpaProfileListItem[]): SpaProfileListItem | null {
  return profiles.find((p) => p.isPrimary) ?? profiles[0] ?? null;
}

function storageKey(tenantId: string) {
  return `active_spa_profile_id:${tenantId}`;
}

type ActiveSpaContextValue = {
  spaProfileId: string | undefined;
  setSpaProfileId: (id: string | undefined) => Promise<void>;
  spaProfiles: SpaProfileListItem[];
  spaProfilesLoading: boolean;
  refreshSpaProfiles: () => Promise<void>;
};

const ActiveSpaContext = createContext<ActiveSpaContextValue | undefined>(undefined);

export function ActiveSpaProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { config } = useTenant();
  const tenantId = config?.tenantId;
  const [spaProfiles, setSpaProfiles] = useState<SpaProfileListItem[]>([]);
  const [spaProfilesLoading, setSpaProfilesLoading] = useState(false);
  const [spaProfileId, setSpaProfileIdState] = useState<string | undefined>(undefined);

  const refreshSpaProfiles = useCallback(async () => {
    if (!user) {
      setSpaProfiles([]);
      setSpaProfileIdState(undefined);
      return;
    }
    setSpaProfilesLoading(true);
    try {
      const res = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: SpaProfileListItem[] } };
      const list = res?.data?.spaProfiles ?? [];
      setSpaProfiles(list);
      if (!tenantId) {
        setSpaProfileIdState(pickPrimary(list)?.id);
        return;
      }
      const stored = (await AsyncStorage.getItem(storageKey(tenantId)))?.trim();
      const validStored = stored && list.some((p) => p.id === stored) ? stored : undefined;
      if (stored && !validStored) {
        await AsyncStorage.removeItem(storageKey(tenantId));
      }
      const next = validStored ?? pickPrimary(list)?.id;
      setSpaProfileIdState(next);
      if (next && !validStored && list.length) {
        await AsyncStorage.setItem(storageKey(tenantId), next);
      }
    } catch {
      setSpaProfiles([]);
      setSpaProfileIdState(undefined);
    } finally {
      setSpaProfilesLoading(false);
    }
  }, [user, tenantId]);

  useEffect(() => {
    void refreshSpaProfiles();
  }, [refreshSpaProfiles]);

  const setSpaProfileId = useCallback(
    async (id: string | undefined) => {
      setSpaProfileIdState(id);
      if (tenantId && id) {
        await AsyncStorage.setItem(storageKey(tenantId), id);
      } else if (tenantId) {
        await AsyncStorage.removeItem(storageKey(tenantId));
      }
    },
    [tenantId]
  );

  const value = useMemo(
    (): ActiveSpaContextValue => ({
      spaProfileId,
      setSpaProfileId,
      spaProfiles,
      spaProfilesLoading,
      refreshSpaProfiles,
    }),
    [spaProfileId, setSpaProfileId, spaProfiles, spaProfilesLoading, refreshSpaProfiles]
  );

  return <ActiveSpaContext.Provider value={value}>{children}</ActiveSpaContext.Provider>;
}

export function useActiveSpa(): ActiveSpaContextValue {
  const ctx = useContext(ActiveSpaContext);
  if (!ctx) {
    throw new Error('useActiveSpa must be used within ActiveSpaProvider');
  }
  return ctx;
}
