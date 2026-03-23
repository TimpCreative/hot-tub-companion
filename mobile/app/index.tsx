import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { View, Text, StyleSheet } from 'react-native';
import api from '../services/api';
import { getSetupSkippedFlag } from '../lib/setupSkippedStorage';

type Gate = 'loading' | 'login' | 'tabs' | 'onboarding';

export default function Index() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { loading: tenantLoading, error: tenantError } = useTenant();
  const [gate, setGate] = useState<Gate>('loading');

  useEffect(() => {
    let cancelled = false;
    async function decide() {
      if (tenantLoading || authLoading) return;
      if (tenantError) {
        return;
      }
      if (!user) {
        if (!cancelled) setGate('login');
        return;
      }
      try {
        const res = (await api.get('/spa-profiles')) as { data?: { spaProfiles?: unknown[] } };
        const list = res?.data?.spaProfiles ?? [];
        if (list.length > 0) {
          if (!cancelled) setGate('tabs');
          return;
        }
        const skipped = await getSetupSkippedFlag();
        if (skipped) {
          if (!cancelled) setGate('tabs');
          return;
        }
        if (!cancelled) setGate('onboarding');
      } catch {
        if (!cancelled) setGate('tabs');
      }
    }
    decide();
    return () => {
      cancelled = true;
    };
  }, [tenantLoading, authLoading, user, tenantError]);

  useEffect(() => {
    if (tenantLoading || authLoading) return;
    SplashScreen.hideAsync();
    if (tenantError) return;
    if (gate === 'login') {
      router.replace('/auth/login');
    } else if (gate === 'tabs') {
      router.replace('/(tabs)/home');
    } else if (gate === 'onboarding') {
      router.replace('/onboarding');
    }
  }, [gate, tenantLoading, authLoading, tenantError, router]);

  if (tenantError) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{tenantError}</Text>
      </View>
    );
  }

  return <LoadingSpinner />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  error: {
    color: '#dc2626',
    textAlign: 'center',
  },
});
